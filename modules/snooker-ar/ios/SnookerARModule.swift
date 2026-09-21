import ARKit
import ExpoModulesCore

/// A point in the AR world, in metres. ARKit's y is up.
struct ARVec3: Record {
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var z: Double = 0
}

/// Something to draw on the table: a ball, a see-through ghost of one, or a flat landmark marker.
struct ARBall: Record {
  @Field var id: String = ""
  @Field var colour: String = "#FFFFFF"
  @Field var x: Double = 0
  @Field var y: Double = 0
  @Field var z: Double = 0
  /// "ball", "ghost" or "marker".
  @Field var kind: String = "ball"
  @Field var highlighted: Bool = false
}

/// A line on the table (the cushions, the baulk line, the D), as points to join.
struct ARLine: Record {
  @Field var points: [ARVec3] = []
  @Field var colour: String = "#FFFFFF"
}

public class SnookerARModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SnookerAR")

    /// Whether this phone can run the AR view at all.
    Function("isSupported") { () -> Bool in
      return ARWorldTrackingConfiguration.isSupported
    }

    /// LiDAR phones place points far more precisely; the app says so when calibrating.
    Function("hasLiDAR") { () -> Bool in
      if #available(iOS 13.4, *) {
        return ARWorldTrackingConfiguration.supportsSceneReconstruction(.mesh)
      }
      return false
    }

    View(SnookerARView.self) {
      Events("onTracking", "onPlane", "onAim", "onTapPoint")

      Prop("balls") { (view: SnookerARView, balls: [ARBall]) in
        view.setBalls(balls)
      }

      Prop("lines") { (view: SnookerARView, lines: [ARLine]) in
        view.setLines(lines)
      }

      Prop("paused") { (view: SnookerARView, paused: Bool) in
        view.setPaused(paused)
      }
    }
  }
}
