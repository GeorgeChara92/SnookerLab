import ARKit
import CoreVideo
import Foundation
import simd

/// Looks for balls on the cloth while the player walks a lap of the table, for Record a Snooker.
///
/// A few times a second it takes a sharp camera frame, keeps only the pixels that land on the
/// table, works out what colour the cloth is, and finds the round patches that are not cloth and
/// are the right size to be a ball from where the camera is standing. Each one goes to JavaScript
/// as a ray from the camera with the colour it saw. It never says which ball it is looking at, or
/// whether it is real: that comes from many views agreeing, and is worked out and tested in
/// `features/scanSnooker/lap.ts`.
///
/// It only exists while a lap is being walked. Scan Snooker never creates one.
final class SnookerLapDetector {
  /// The table in the AR world, in metres. `ballHeight` is the height of a ball's centre, and
  /// `width` and `length` are the bed's regulation size - `scale` is what stretches them to this
  /// real table.
  struct Table {
    let originX: Float
    let originZ: Float
    let cosAngle: Float
    let sinAngle: Float
    let ballHeight: Float
    let scale: Float
    let width: Float
    let length: Float
  }

  private struct Peak {
    let column: Int
    let row: Int
    let radius: Float
  }

  var table: Table
  var onResult: (([String: Any]) -> Void)?

  /// Off the main thread, so walking the lap never makes the camera view stutter.
  private let queue = DispatchQueue(label: "app.snookerlab.lap", qos: .userInitiated)
  private var busy = false
  private var lastSample: TimeInterval = 0
  private var previousForward: simd_float3?
  private var blurred = 0

  /// Frames looked at each second: a lap takes about 30 seconds, so around 120 views of the table.
  private static let sampleInterval: TimeInterval = 0.25
  /// Camera turn between two frames (a 60th of a second) that smears a ball too much to measure.
  private static let blurLimit: Float = 0.012
  /// Each cell of the working grid is this many camera pixels across. A ball is about 16 cells
  /// wide from 1.2m, and every ball comes within that of someone walking round the table.
  private static let gridStep = 4
  /// Far enough to see the far corner from behind the baulk cushion. A ball there is just over
  /// two cells across in radius, still enough to measure; JavaScript allows more room along the
  /// line of sight for these shallow views.
  private static let maxDistance: Float = 4.2
  /// How far past the cushions to look: enough for a ball touching one, seen at a low angle.
  private static let tableMargin: Float = 0.015
  private static let ballRadius: Float = 0.02625
  private static let minimumCells = 800
  /// How different from the cloth a cell must be to count as something on it.
  private static let chromaLimit = 24
  private static let darkPercent = 55
  private static let brightPercent = 165
  /// A ball's measured size against what it should be from this distance.
  private static let fitRange: ClosedRange<Float> = 0.6...1.4
  private static let maxSightings = 40

  init(table: Table) {
    self.table = table
  }

  /// Called with every camera frame, on the main thread. Only keeps hold of the frame's pixels and
  /// only one at a time, because ARKit stops delivering frames if too many are retained.
  func consider(_ frame: ARFrame) {
    let forward = simd_make_float3(frame.camera.transform.columns.2)
    let previous = previousForward
    previousForward = forward

    guard !busy, frame.timestamp - lastSample >= SnookerLapDetector.sampleInterval else { return }
    guard case .normal = frame.camera.trackingState else { return }
    if let previous = previous, simd_length(forward - previous) > SnookerLapDetector.blurLimit {
      blurred += 1
      return
    }

    lastSample = frame.timestamp
    busy = true
    let pixels = frame.capturedImage
    let transform = frame.camera.transform
    let intrinsics = frame.camera.intrinsics
    let table = self.table
    let blurredSinceLast = blurred
    blurred = 0

    queue.async { [weak self] in
      var look = SnookerLapDetector.detect(pixels: pixels, transform: transform, intrinsics: intrinsics, table: table)
      look?["blurred"] = blurredSinceLast
      let result = look
      DispatchQueue.main.async {
        guard let self = self else { return }
        self.busy = false
        if let result = result {
          self.onResult?(result)
        }
      }
    }
  }

  /// A ball's centre, in grid cells, measured from its top edge rather than from the middle of the
  /// patch it makes. Under table lights a ball's shadow lies on the cloth right below it, joined to
  /// it in the picture, so the patch's middle sits towards the shadow - on a real table that put
  /// every ball's ring in front of the ball (seen 2026-11-06). The top of a ball is never in its
  /// own shadow: the centre is one radius down from the top edge, and halfway between the sides
  /// half a radius down. If anything else is joined on - a touching ball above or beside it - the
  /// edges aren't where one ball's would be, and the patch's middle is kept.
  ///
  /// "Up" is the real world's up as it falls in the picture, `upward` (columns, rows). The camera's
  /// picture is landscape whichever way the phone is held, so it is rarely the picture's own top.
  private static func centreFromTop(
    peak: Peak,
    expected: Float,
    upward: SIMD2<Float>,
    cells: UnsafeMutablePointer<UInt8>,
    width: Int,
    height: Int
  ) -> (column: Float, row: Float) {
    let found: (column: Float, row: Float) = (column: Float(peak.column), row: Float(peak.row))
    // Looking almost straight down, the shadow is hidden under the ball and "up" means nothing.
    let length = (upward.x * upward.x + upward.y * upward.y).squareRoot()
    guard length > 0.2 else { return found }
    let up = upward / length
    let across = SIMD2<Float>(-up.y, up.x)

    let isBall = { (point: SIMD2<Float>) -> Bool in
      let column = Int(point.x.rounded())
      let row = Int(point.y.rounded())
      guard column >= 0, column < width, row >= 0, row < height else { return false }
      return cells[row * width + column] == 2
    }
    /// How far the ball goes from `start` along `direction`, or nil if it runs on past `limit`.
    let extent = { (start: SIMD2<Float>, direction: SIMD2<Float>, limit: Float) -> Float? in
      var reach: Float = 0
      while reach < limit {
        if !isBall(start + direction * (reach + 1)) { return reach + 0.5 }
        reach += 1
      }
      return nil
    }

    let peakPoint = SIMD2<Float>(Float(peak.column), Float(peak.row))
    var centre = peakPoint
    for _ in 0..<2 {
      guard isBall(centre), let toTop = extent(centre, up, expected * 2.2) else { return found }
      let top = centre + up * toTop
      let chord = top - up * (expected * 0.5)
      guard
        isBall(chord),
        let towardsOne = extent(chord, across, expected * 1.4),
        let towardsOther = extent(chord, -across, expected * 1.4)
      else { return found }
      let next = top - up * expected + across * ((towardsOne - towardsOther) / 2)
      let shift = next - peakPoint
      guard (shift.x * shift.x + shift.y * shift.y).squareRoot() <= expected else { return found }
      centre = next
    }
    return (column: centre.x, row: centre.y)
  }

  private static func vector(_ value: simd_float3) -> [String: Double] {
    return ["x": Double(value.x), "y": Double(value.y), "z": Double(value.z)]
  }

  private static func median(_ histogram: [Int32], total: Int) -> Int {
    var seen = 0
    for (value, count) in histogram.enumerated() {
      seen += Int(count)
      if seen * 2 >= total { return value }
    }
    return 0
  }

  private static func detect(
    pixels: CVPixelBuffer,
    transform: simd_float4x4,
    intrinsics: simd_float3x3,
    table: Table
  ) -> [String: Any]? {
    guard
      CVPixelBufferGetPixelFormatType(pixels) == kCVPixelFormatType_420YpCbCr8BiPlanarFullRange,
      CVPixelBufferGetPlaneCount(pixels) == 2
    else { return nil }

    let started = Date()
    CVPixelBufferLockBaseAddress(pixels, .readOnly)
    defer { CVPixelBufferUnlockBaseAddress(pixels, .readOnly) }

    guard
      let lumaBase = CVPixelBufferGetBaseAddressOfPlane(pixels, 0),
      let chromaBase = CVPixelBufferGetBaseAddressOfPlane(pixels, 1)
    else { return nil }
    let luma = lumaBase.assumingMemoryBound(to: UInt8.self)
    let chroma = chromaBase.assumingMemoryBound(to: UInt8.self)
    let lumaStride = CVPixelBufferGetBytesPerRowOfPlane(pixels, 0)
    let chromaStride = CVPixelBufferGetBytesPerRowOfPlane(pixels, 1)

    // Chroma is half the camera's resolution, so a grid cell is every other chroma sample.
    let width = CVPixelBufferGetWidthOfPlane(pixels, 1) / 2
    let height = CVPixelBufferGetHeightOfPlane(pixels, 1) / 2
    guard width > 2, height > 2 else { return nil }
    let count = width * height
    let step = gridStep

    let fx = intrinsics.columns.0.x
    let fy = intrinsics.columns.1.y
    let cx = intrinsics.columns.2.x
    let cy = intrinsics.columns.2.y

    // The camera looks down its own -z, with x along the image and y up it.
    let right = simd_make_float3(transform.columns.0)
    let up = simd_make_float3(transform.columns.1)
    let back = simd_make_float3(transform.columns.2)
    let origin = simd_make_float3(transform.columns.3)

    var payload: [String: Any] = ["camera": vector(origin), "sightings": [[String: Any]]()]

    // 0 is off the table, 1 is cloth, 2 is something on the cloth.
    let cells = UnsafeMutablePointer<UInt8>.allocate(capacity: count)
    cells.initialize(repeating: 0, count: count)
    let depth = UnsafeMutablePointer<UInt16>.allocate(capacity: count)
    depth.initialize(repeating: 0, count: count)
    defer {
      cells.deallocate()
      depth.deallocate()
    }

    var lumaHistogram = [Int32](repeating: 0, count: 256)
    var blueHistogram = [Int32](repeating: 0, count: 256)
    var redHistogram = [Int32](repeating: 0, count: 256)
    var inside = 0

    // Which cells land on the table, followed to the height of a ball's centre. Doing it from each
    // cell's ray rather than drawing the table's corners on the image means it still works with
    // part of the table behind the camera, which is most of the time on a lap.
    for row in 0..<height {
      let v = Float(row * step + step / 2)
      let down: Float = (v - cy) / fy
      let rowDirection: simd_float3 = up * (-down) - back
      for column in 0..<width {
        let u = Float(column * step + step / 2)
        let across: Float = (u - cx) / fx
        let direction: simd_float3 = rowDirection + right * across
        guard direction.y < -0.0001 else { continue }
        let reach = (table.ballHeight - origin.y) / direction.y
        guard reach > 0, reach * simd_length(direction) <= maxDistance else { continue }

        let point: simd_float3 = origin + direction * reach
        let offsetX: Float = point.x - table.originX
        let offsetZ: Float = point.z - table.originZ
        let tableX: Float = (offsetX * table.cosAngle + offsetZ * table.sinAngle) / table.scale
        let tableY: Float = (offsetZ * table.cosAngle - offsetX * table.sinAngle) / table.scale
        guard
          tableX >= -tableMargin, tableX <= table.width + tableMargin,
          tableY >= -tableMargin, tableY <= table.length + tableMargin
        else { continue }

        cells[row * width + column] = 1
        inside += 1
        let chromaAt = (row * 2) * chromaStride + (column * 2) * 2
        lumaHistogram[Int(luma[(row * step + 2) * lumaStride + column * step + 2])] += 1
        blueHistogram[Int(chroma[chromaAt])] += 1
        redHistogram[Int(chroma[chromaAt + 1])] += 1
      }
    }

    // Too little table in view to tell what the cloth is, so nothing can be picked out of it.
    guard inside >= minimumCells else {
      payload["ms"] = Date().timeIntervalSince(started) * 1000
      return payload
    }

    // Balls are a tiny share of the table, so the middle value of everything on it is the cloth.
    let clothLuma = median(lumaHistogram, total: inside)
    let clothBlue = median(blueHistogram, total: inside)
    let clothRed = median(redHistogram, total: inside)
    payload["cloth"] = ["y": Double(clothLuma), "cb": Double(clothBlue), "cr": Double(clothRed)]

    for row in 0..<height {
      for column in 0..<width {
        let index = row * width + column
        guard cells[index] == 1 else { continue }
        let chromaAt = (row * 2) * chromaStride + (column * 2) * 2
        let lumaValue = Int(luma[(row * step + 2) * lumaStride + column * step + 2])
        let blueDifference: Int = abs(Int(chroma[chromaAt]) - clothBlue)
        let redDifference: Int = abs(Int(chroma[chromaAt + 1]) - clothRed)
        if blueDifference + redDifference > chromaLimit
          || lumaValue * 100 < clothLuma * darkPercent
          || lumaValue * 100 > clothLuma * brightPercent {
          cells[index] = 2
        }
      }
    }

    // How deep inside something each cell is, in thirds of a cell. A ball peaks at its centre with
    // its radius, touching balls keep a peak each, and the chalk lines never get deep enough.
    let unreached: UInt16 = 60000
    for row in 1..<(height - 1) {
      for column in 1..<(width - 1) {
        let index = row * width + column
        if cells[index] == 2 { depth[index] = unreached }
      }
    }
    for row in 1..<(height - 1) {
      for column in 1..<(width - 1) {
        let index = row * width + column
        guard depth[index] > 0 else { continue }
        var value = Int(depth[index])
        value = min(value, Int(depth[index - 1]) + 3)
        value = min(value, Int(depth[index - width]) + 3)
        value = min(value, Int(depth[index - width - 1]) + 4)
        value = min(value, Int(depth[index - width + 1]) + 4)
        depth[index] = UInt16(value)
      }
    }
    for row in stride(from: height - 2, to: 0, by: -1) {
      for column in stride(from: width - 2, to: 0, by: -1) {
        let index = row * width + column
        guard depth[index] > 0 else { continue }
        var value = Int(depth[index])
        value = min(value, Int(depth[index + 1]) + 3)
        value = min(value, Int(depth[index + width]) + 3)
        value = min(value, Int(depth[index + width + 1]) + 4)
        value = min(value, Int(depth[index + width - 1]) + 4)
        depth[index] = UInt16(value)
      }
    }

    var peaks: [Peak] = []
    for row in 1..<(height - 1) {
      for column in 1..<(width - 1) {
        let index = row * width + column
        let value = depth[index]
        guard value >= 6 else { continue }
        if depth[index - 1] > value || depth[index + 1] > value { continue }
        if depth[index - width] > value || depth[index + width] > value { continue }
        if depth[index - width - 1] > value || depth[index - width + 1] > value { continue }
        if depth[index + width - 1] > value || depth[index + width + 1] > value { continue }
        peaks.append(Peak(column: column, row: row, radius: Float(value) / 3))
      }
    }
    peaks.sort { $0.radius > $1.radius }

    // Biggest first, dropping any peak inside one already kept: a ball can have a few level ones.
    var kept: [Peak] = []
    for peak in peaks {
      if kept.count >= maxSightings { break }
      let clear = kept.allSatisfy { other in
        let dx = Float(peak.column - other.column)
        let dy = Float(peak.row - other.row)
        let gap = other.radius * 1.2
        return dx * dx + dy * dy >= gap * gap
      }
      if clear { kept.append(peak) }
    }

    // The world's up as it falls in the picture: columns run along the camera's right, rows run
    // against its up.
    let upward = SIMD2<Float>(right.y, -up.y)

    var sightings: [[String: Any]] = []
    for peak in kept {
      // Cut off by the edge of the picture, it would look smaller and off-centre.
      let edge = Int(peak.radius) + 1
      guard
        peak.column >= edge, peak.column < width - edge,
        peak.row >= edge, peak.row < height - edge
      else { continue }

      let u = Float(peak.column * step + step / 2)
      let v = Float(peak.row * step + step / 2)
      let across: Float = (u - cx) / fx
      let down: Float = (v - cy) / fy
      let direction: simd_float3 = right * across - up * down - back
      guard direction.y < -0.0001 else { continue }
      let reach = (table.ballHeight - origin.y) / direction.y
      guard reach > 0 else { continue }

      // `reach` is also how far in front of the camera it is, which is what sets its size.
      let expected = fx * ballRadius / reach / Float(step)
      let fit = peak.radius / expected
      guard fitRange.contains(fit) else { continue }

      // The middle of the patch is pulled towards the ball's shadow, which is joined on below it.
      // Measured down from the top of the ball instead, the shadow doesn't come into it.
      let centre = SnookerLapDetector.centreFromTop(
        peak: peak, expected: expected, upward: upward, cells: cells, width: width, height: height
      )
      let centreU = centre.column * Float(step) + Float(step) / 2
      let centreV = centre.row * Float(step) + Float(step) / 2
      let centreAcross: Float = (centreU - cx) / fx
      let centreDown: Float = (centreV - cy) / fy
      let centreDirection: simd_float3 = right * centreAcross - up * centreDown - back
      guard centreDirection.y < -0.0001 else { continue }
      let centreReach = (table.ballHeight - origin.y) / centreDirection.y
      guard centreReach > 0 else { continue }

      // The colour, read from the top half of the ball round its corrected centre. The bottom half
      // is in the ball's own shade and next to its shadow, and read there a red came out as the
      // black (seen 2026-11-08). The middle value of each channel, not the average, so the shine
      // from the lights on top doesn't wash it out either.
      let inner = max(1, Int(expected * 0.65))
      let centreRow = Int(centre.row.rounded())
      let centreColumn = Int(centre.column.rounded())
      let upLength = (upward.x * upward.x + upward.y * upward.y).squareRoot()
      var upper: [(y: Int, cb: Int, cr: Int)] = []
      var whole: [(y: Int, cb: Int, cr: Int)] = []
      for rowOffset in -inner...inner {
        for columnOffset in -inner...inner {
          guard rowOffset * rowOffset + columnOffset * columnOffset <= inner * inner else { continue }
          let row = centreRow + rowOffset
          let column = centreColumn + columnOffset
          guard row >= 0, row < height, column >= 0, column < width else { continue }
          guard cells[row * width + column] == 2 else { continue }
          let chromaAt = (row * 2) * chromaStride + (column * 2) * 2
          let sample = (
            y: Int(luma[(row * step + 2) * lumaStride + column * step + 2]),
            cb: Int(chroma[chromaAt]),
            cr: Int(chroma[chromaAt + 1])
          )
          whole.append(sample)
          let towardsTop = Float(columnOffset) * upward.x + Float(rowOffset) * upward.y
          if upLength <= 0.2 || towardsTop >= 0 { upper.append(sample) }
        }
      }
      let samples = upper.isEmpty ? whole : upper
      guard !samples.isEmpty else { continue }
      let middle = { (values: [Int]) -> Double in Double(values.sorted()[values.count / 2]) }

      sightings.append([
        "origin": vector(origin),
        "direction": vector(centreDirection),
        "distance": Double(centreReach * simd_length(centreDirection)),
        "fit": Double(fit),
        "y": middle(samples.map { $0.y }),
        "cb": middle(samples.map { $0.cb }),
        "cr": middle(samples.map { $0.cr }),
      ])
    }

    payload["sightings"] = sightings
    payload["ms"] = Date().timeIntervalSince(started) * 1000
    return payload
  }
}
