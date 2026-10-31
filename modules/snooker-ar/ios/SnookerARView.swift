import ARKit
import ExpoModulesCore
import SceneKit
import UIKit

/// The camera view for Scan Snooker.
///
/// Deliberately small: it runs the AR session, tells JavaScript where the camera is pointing
/// (as a ray, and where that ray meets the table), and draws what it is given. All the snooker -
/// calibration, table positions, which ball is where - is worked out in JavaScript, where it is
/// tested, so this view never needs to know what a snooker table is.
class SnookerARView: ExpoView, ARSCNViewDelegate, ARSessionDelegate {
  let onTracking = EventDispatcher()
  let onPlane = EventDispatcher()
  let onAim = EventDispatcher()
  let onTapPoint = EventDispatcher()
  let onMarkerMoved = EventDispatcher()
  let onLapFrame = EventDispatcher()

  private let sceneView = ARSCNView(frame: .zero)
  private let coaching = ARCoachingOverlayView()
  private let linesNode = SCNNode()
  private var ballNodes: [String: SCNNode] = [:]
  /// A real ARAnchor per calibration marker, keyed by its ball id, so ARKit keeps correcting its
  /// position as tracking improves - a plain node placed once would stay behind and appear to
  /// drift as the phone moves, which is exactly what happened when walking round the table.
  private var landmarkAnchors: [String: ARAnchor] = [:]
  /// The marker waiting for its ARAnchor to come back from the session, keyed by the anchor's own
  /// id, so `renderer(_:didAdd:for:)` knows what to build once ARKit has a node for it.
  private var pendingAnchorBalls: [UUID: ARBall] = [:]
  /// Reverse of `landmarkAnchors`, so `renderer(_:didUpdate:for:)` can tell JavaScript which ball
  /// moved when ARKit corrects an anchor it has already added.
  private var anchorBallIds: [UUID: String] = [:]
  /// The position last reported for each marker, so a correction under `markerCorrectionThreshold`
  /// - noise, not a real refinement - does not spam the bridge on every single frame.
  private var lastReportedMarkerPosition: [String: simd_float3] = [:]
  /// Below this, a correction is ARKit's frame-to-frame tracking noise, not a real refinement -
  /// seen on a real table as the marker trembling in place even though nothing had actually
  /// changed, because the marker's mesh used to be a direct child of the anchor's own node, which
  /// ARSCNView re-syncs to the anchor's live transform every single frame with no filtering at
  /// all (confirmed 2026-10-08). The marker is now a free node that `didUpdate` repositions
  /// itself, gated by this same threshold, so the dot only visibly moves for a correction large
  /// enough to matter - the same one JavaScript is told about, so the two can never disagree about
  /// what counts as "moved".
  private let markerCorrectionThreshold: Float = 0.003
  private var planeCount = 0
  private var lastAimTime: TimeInterval = 0
  private var isPaused = false
  private var isRunning = false
  /// Only there while Record a Snooker's lap is being walked - see `setLapTable`.
  private var lapDetector: SnookerLapDetector?

  /// A snooker ball, 52.5mm across.
  private let ballRadius: CGFloat = 0.02625

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true

    sceneView.delegate = self
    sceneView.session.delegate = self
    sceneView.autoenablesDefaultLighting = true
    sceneView.automaticallyUpdatesLighting = true
    sceneView.scene.rootNode.addChildNode(linesNode)
    addSubview(sceneView)

    // Apple's own guidance ("move iPhone to start") until the table's surface is found.
    coaching.session = sceneView.session
    coaching.goal = .horizontalPlane
    coaching.activatesAutomatically = true
    addSubview(coaching)

    let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
    sceneView.addGestureRecognizer(tap)
  }

  deinit {
    sceneView.session.pause()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    sceneView.frame = bounds
    coaching.frame = bounds
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil {
      if !isPaused { startSession() }
    } else {
      sceneView.session.pause()
      isRunning = false
    }
  }

  // MARK: - Session

  private func startSession() {
    guard !isRunning else { return }
    guard ARWorldTrackingConfiguration.isSupported else {
      onTracking(["state": "unsupported", "reason": ""])
      return
    }
    let configuration = ARWorldTrackingConfiguration()
    configuration.planeDetection = [.horizontal]
    configuration.environmentTexturing = .automatic
    if #available(iOS 13.4, *) {
      // On LiDAR phones, a mesh of the room makes every point the camera finds far more precise.
      if ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh) {
        configuration.sceneReconstruction = .mesh
      }
    }
    planeCount = 0
    // Anchors and their nodes do not survive a tracking reset; forget them so a marker tapped
    // before a pause is recreated rather than assumed still in place.
    landmarkAnchors.removeAll()
    pendingAnchorBalls.removeAll()
    anchorBallIds.removeAll()
    lastReportedMarkerPosition.removeAll()
    ballNodes.values.forEach { $0.removeFromParentNode() }
    ballNodes.removeAll()
    sceneView.session.run(configuration, options: [.resetTracking, .removeExistingAnchors])
    isRunning = true
  }

  func setPaused(_ paused: Bool) {
    isPaused = paused
    if paused {
      sceneView.session.pause()
      isRunning = false
    } else if window != nil {
      startSession()
    }
  }

  func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
    var state = "normal"
    var reason = ""
    switch camera.trackingState {
    case .normal:
      state = "normal"
    case .notAvailable:
      state = "unavailable"
    case .limited(let why):
      state = "limited"
      switch why {
      case .excessiveMotion: reason = "excessiveMotion"
      case .insufficientFeatures: reason = "insufficientFeatures"
      case .initializing: reason = "initializing"
      case .relocalizing: reason = "relocalizing"
      @unknown default: reason = "unknown"
      }
    }
    onTracking(["state": state, "reason": reason])
  }

  func session(_ session: ARSession, didFailWithError error: Error) {
    onTracking(["state": "failed", "reason": error.localizedDescription])
  }

  func sessionWasInterrupted(_ session: ARSession) {
    onTracking(["state": "limited", "reason": "interrupted"])
  }

  func renderer(_ renderer: SCNSceneRenderer, didAdd node: SCNNode, for anchor: ARAnchor) {
    // `setBalls` runs on the main thread (an Expo view prop); this delegate call is not
    // guaranteed to be, so the dictionaries it shares with `setBalls` are only touched here
    // after hopping to main, to avoid the two racing on the same anchor.
    DispatchQueue.main.async {
      if let ball = self.pendingAnchorBalls.removeValue(forKey: anchor.identifier) {
        // Not a child of `node` (the anchor's own node) - see `markerCorrectionThreshold` above
        // for why. This free node starts at the anchor's position and `didUpdate` moves it from
        // here on, only when a correction clears the noise threshold.
        let content = self.makeNode(for: ball)
        content.name = "\(ball.kind)|\(ball.colour)|\(ball.highlighted)"
        content.simdPosition = simd_make_float3(anchor.transform.columns.3)
        self.sceneView.scene.rootNode.addChildNode(content)
        self.ballNodes[ball.id] = content
        return
      }
      guard anchor is ARPlaneAnchor else { return }
      self.planeCount += 1
      self.onPlane(["count": self.planeCount])
    }
  }

  /// ARKit calls this whenever it corrects an anchor's transform as its map of the room improves -
  /// which is the whole reason a calibration marker gets a real ARAnchor rather than a plain node.
  /// Reporting the correction to JavaScript, not just moving the marker's own mesh, is what lets
  /// the table frame it is built from stay current instead of being frozen at the moment of the
  /// tap: a fix computed once from two taps and never revisited is exactly what let the on-screen
  /// dots keep tracking correctly while the invisible maths they fed drifted away underneath them.
  func renderer(_ renderer: SCNSceneRenderer, didUpdate node: SCNNode, for anchor: ARAnchor) {
    let identifier = anchor.identifier
    let position = anchor.transform.columns.3
    let current = simd_float3(position.x, position.y, position.z)
    DispatchQueue.main.async {
      guard let ballId = self.anchorBallIds[identifier] else { return }
      if let last = self.lastReportedMarkerPosition[ballId], simd_distance(last, current) < self.markerCorrectionThreshold {
        return
      }
      self.lastReportedMarkerPosition[ballId] = current
      self.ballNodes[ballId]?.simdPosition = current
      self.onMarkerMoved(["id": ballId, "x": Double(current.x), "y": Double(current.y), "z": Double(current.z)])
    }
  }

  /// Where the middle of the screen is pointing, ten times a second, for the crosshair.
  func session(_ session: ARSession, didUpdate frame: ARFrame) {
    lapDetector?.consider(frame)
    let now = frame.timestamp
    guard now - lastAimTime >= 0.1 else { return }
    lastAimTime = now
    let centre = CGPoint(x: sceneView.bounds.midX, y: sceneView.bounds.midY)
    onAim(pointPayload(at: centre))
  }

  @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
    onTapPoint(pointPayload(at: gesture.location(in: sceneView)))
  }

  /// The ray through a point on the screen, and where it meets the table's surface if it does.
  /// JavaScript uses the ray to find a ball's centre: it meets a level a ball's radius above
  /// the cloth, not the cloth itself, so aiming at the top of a ball still finds where it sits.
  private func pointPayload(at point: CGPoint) -> [String: Any] {
    var payload: [String: Any] = ["screenX": Double(point.x), "screenY": Double(point.y), "ok": false]
    guard let query = sceneView.raycastQuery(from: point, allowing: .estimatedPlane, alignment: .horizontal) else {
      return payload
    }
    payload["ok"] = true
    payload["origin"] = vector(query.origin)
    payload["direction"] = vector(query.direction)

    var hit: ARRaycastResult?
    if let planeQuery = sceneView.raycastQuery(from: point, allowing: .existingPlaneGeometry, alignment: .horizontal) {
      hit = sceneView.session.raycast(planeQuery).first
    }
    if hit == nil {
      hit = sceneView.session.raycast(query).first
    }
    if let hit = hit {
      let position = hit.worldTransform.columns.3
      payload["hit"] = ["x": Double(position.x), "y": Double(position.y), "z": Double(position.z)]
    }
    return payload
  }

  private func vector(_ value: simd_float3) -> [String: Double] {
    return ["x": Double(value.x), "y": Double(value.y), "z": Double(value.z)]
  }

  // MARK: - Lap

  /// Record a Snooker's lap: given the table, look for balls; given nothing, stop. Scan Snooker
  /// never sets this, so no detector exists and it runs just as it did.
  func setLapTable(_ table: ARLapTable?) {
    guard let table = table else {
      lapDetector = nil
      return
    }
    let values = SnookerLapDetector.Table(
      originX: Float(table.originX),
      originZ: Float(table.originZ),
      cosAngle: Float(cos(table.angle)),
      sinAngle: Float(sin(table.angle)),
      ballHeight: Float(table.ballHeight),
      scale: Float(table.scale),
      width: Float(table.width),
      length: Float(table.length)
    )
    if let lapDetector = lapDetector {
      lapDetector.table = values
      return
    }
    let detector = SnookerLapDetector(table: values)
    detector.onResult = { [weak self] payload in
      self?.onLapFrame(payload)
    }
    lapDetector = detector
  }

  // MARK: - Drawing

  /// Balls, ghosts and markers, matched by id so only what changed is rebuilt.
  ///
  /// A "marker" - a calibration landmark - gets a real ARAnchor at the tapped position instead of
  /// a plain node, because it is placed once and then relied on for the rest of the session, while
  /// the phone keeps moving (walking to the next landmark, round the table, and back). ARKit
  /// corrects an anchor's transform as its map of the room improves; a plain node has no such
  /// correction, and visibly drifts or sinks into the table over that same time. Balls and ghosts
  /// are placed and read back within a single frame of aiming, so they do not need this.
  ///
  /// JavaScript keeps sending both markers for the rest of the session (not only during
  /// calibration), so their anchors are never torn down: `renderer(_:didUpdate:for:)` reports each
  /// correction back via `onMarkerMoved`, and the table frame those two points define is rebuilt
  /// from the corrected positions rather than staying frozen at the moment of the tap.
  func setBalls(_ balls: [ARBall]) {
    var seen = Set<String>()
    for ball in balls {
      seen.insert(ball.id)
      if ball.kind == "marker" {
        if landmarkAnchors[ball.id] == nil {
          let anchor = ARAnchor(transform: pointTransform(x: ball.x, y: ball.y, z: ball.z))
          pendingAnchorBalls[anchor.identifier] = ball
          landmarkAnchors[ball.id] = anchor
          anchorBallIds[anchor.identifier] = ball.id
          sceneView.session.add(anchor: anchor)
        }
        continue
      }
      let key = "\(ball.kind)|\(ball.colour)|\(ball.highlighted)"
      var node = ballNodes[ball.id]
      if node == nil || node?.name != key {
        node?.removeFromParentNode()
        let fresh = makeNode(for: ball)
        fresh.name = key
        sceneView.scene.rootNode.addChildNode(fresh)
        ballNodes[ball.id] = fresh
        node = fresh
      }
      node?.position = SCNVector3(Float(ball.x), Float(ball.y), Float(ball.z))
    }
    for (id, node) in ballNodes where !seen.contains(id) {
      node.removeFromParentNode()
      ballNodes.removeValue(forKey: id)
    }
    for (id, anchor) in landmarkAnchors where !seen.contains(id) {
      sceneView.session.remove(anchor: anchor)
      landmarkAnchors.removeValue(forKey: id)
      ballNodes.removeValue(forKey: id)
      anchorBallIds.removeValue(forKey: anchor.identifier)
      lastReportedMarkerPosition.removeValue(forKey: id)
    }
  }

  private func pointTransform(x: Double, y: Double, z: Double) -> simd_float4x4 {
    var transform = matrix_identity_float4x4
    transform.columns.3 = simd_float4(Float(x), Float(y), Float(z), 1)
    return transform
  }

  /// - "ghost": a see-through ball where a ball should go back to. Positioned at the ball's centre.
  /// - "tag": a coloured ring on the cloth round a ball that has been recorded. Positioned at the ball's centre.
  /// - "marker": a small disc on a landmark that was tapped. Positioned on the cloth.
  private func makeNode(for ball: ARBall) -> SCNNode {
    let colour = UIColor(snookerHex: ball.colour)
    let node = SCNNode()

    switch ball.kind {
    case "ghost":
      let sphere = SCNSphere(radius: ballRadius)
      sphere.segmentCount = 32
      let material = SCNMaterial()
      material.diffuse.contents = colour
      material.lightingModel = .physicallyBased
      material.roughness.contents = 0.3
      material.transparency = 0.5
      material.writesToDepthBuffer = false
      sphere.materials = [material]
      node.addChildNode(SCNNode(geometry: sphere))
    case "marker":
      let disc = SCNCylinder(radius: 0.012, height: 0.002)
      disc.firstMaterial?.diffuse.contents = colour
      disc.firstMaterial?.lightingModel = .constant
      node.addChildNode(SCNNode(geometry: disc))
    default:
      let ring = SCNTorus(ringRadius: ballRadius + 0.008, pipeRadius: 0.003)
      ring.firstMaterial?.diffuse.contents = colour
      ring.firstMaterial?.lightingModel = .constant
      let ringNode = SCNNode(geometry: ring)
      ringNode.position = SCNVector3(0, Float(-ballRadius + 0.002), 0)
      node.addChildNode(ringNode)
      node.addChildNode(makeOccluder())
    }

    if ball.highlighted {
      let halo = SCNTorus(ringRadius: ballRadius + 0.02, pipeRadius: 0.0025)
      halo.firstMaterial?.diffuse.contents = UIColor.white
      halo.firstMaterial?.lightingModel = .constant
      let haloNode = SCNNode(geometry: halo)
      haloNode.position = SCNVector3(0, Float(ball.kind == "marker" ? 0.001 : -ballRadius + 0.002), 0)
      node.addChildNode(haloNode)
    }
    return node
  }

  /// The real ball itself, as an invisible sphere: it draws nothing, but it fills the depth buffer
  /// where the ball is, so anything virtual behind it is hidden the way the real ball would hide it.
  ///
  /// Without it the tag's ring - flat on the cloth round the ball - is painted over the camera
  /// image in full, including the half that should be behind the ball. From above that half is
  /// hidden anyway; from the side it was drawn across the ball itself, and walking round the table
  /// the marker looked as if it had slipped off the ball (seen on a real table, 2026-10-23).
  private func makeOccluder() -> SCNNode {
    let sphere = SCNSphere(radius: ballRadius * 0.98)
    sphere.segmentCount = 24
    let material = SCNMaterial()
    material.colorBufferWriteMask = []
    material.writesToDepthBuffer = true
    material.readsFromDepthBuffer = true
    sphere.materials = [material]
    let occluder = SCNNode(geometry: sphere)
    // Drawn before everything else, so the depth it leaves is there when the rings are drawn.
    occluder.renderingOrder = -100
    return occluder
  }

  /// The table drawn over the real one after calibrating, so the player can see it lines up.
  func setLines(_ lines: [ARLine]) {
    linesNode.childNodes.forEach { $0.removeFromParentNode() }
    for line in lines {
      let colour = UIColor(snookerHex: line.colour)
      let points = line.points.map { SCNVector3(Float($0.x), Float($0.y), Float($0.z)) }
      guard points.count > 1 else { continue }
      for index in 0..<(points.count - 1) {
        linesNode.addChildNode(segment(from: points[index], to: points[index + 1], colour: colour))
      }
    }
  }

  private func segment(from start: SCNVector3, to end: SCNVector3, colour: UIColor) -> SCNNode {
    let dx = end.x - start.x
    let dy = end.y - start.y
    let dz = end.z - start.z
    let length = CGFloat(sqrt(dx * dx + dy * dy + dz * dz))
    let cylinder = SCNCylinder(radius: 0.003, height: max(length, 0.0001))
    cylinder.radialSegmentCount = 6
    cylinder.firstMaterial?.diffuse.contents = colour
    cylinder.firstMaterial?.lightingModel = .constant
    let node = SCNNode(geometry: cylinder)
    node.position = SCNVector3((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2)
    // A cylinder stands along its own y axis; turn that to run from start to end.
    node.look(at: end, up: SCNVector3(0, 1, 0), localFront: SCNVector3(0, 1, 0))
    return node
  }
}

private extension UIColor {
  /// "#RRGGBB" or "#RRGGBBAA".
  convenience init(snookerHex: String) {
    var value = snookerHex.trimmingCharacters(in: .whitespacesAndNewlines)
    if value.hasPrefix("#") { value.removeFirst() }
    var number: UInt64 = 0
    Scanner(string: value).scanHexInt64(&number)
    if value.count == 8 {
      self.init(
        red: CGFloat((number >> 24) & 0xFF) / 255,
        green: CGFloat((number >> 16) & 0xFF) / 255,
        blue: CGFloat((number >> 8) & 0xFF) / 255,
        alpha: CGFloat(number & 0xFF) / 255
      )
    } else {
      self.init(
        red: CGFloat((number >> 16) & 0xFF) / 255,
        green: CGFloat((number >> 8) & 0xFF) / 255,
        blue: CGFloat(number & 0xFF) / 255,
        alpha: 1
      )
    }
  }
}
