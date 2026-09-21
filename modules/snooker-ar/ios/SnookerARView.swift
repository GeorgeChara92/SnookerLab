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

  private let sceneView = ARSCNView(frame: .zero)
  private let coaching = ARCoachingOverlayView()
  private let linesNode = SCNNode()
  private var ballNodes: [String: SCNNode] = [:]
  private var planeCount = 0
  private var lastAimTime: TimeInterval = 0
  private var isPaused = false
  private var isRunning = false

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
    guard anchor is ARPlaneAnchor else { return }
    DispatchQueue.main.async {
      self.planeCount += 1
      self.onPlane(["count": self.planeCount])
    }
  }

  /// Where the middle of the screen is pointing, ten times a second, for the crosshair.
  func session(_ session: ARSession, didUpdate frame: ARFrame) {
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

  // MARK: - Drawing

  /// Balls, ghosts and markers, matched by id so only what changed is rebuilt.
  func setBalls(_ balls: [ARBall]) {
    var seen = Set<String>()
    for ball in balls {
      seen.insert(ball.id)
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
