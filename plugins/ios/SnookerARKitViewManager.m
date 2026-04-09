#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <ARKit/ARKit.h>
#import <SceneKit/SceneKit.h>
#import <React/RCTComponent.h>
#import <React/RCTViewManager.h>

@interface SnookerARKitView : UIView <ARSCNViewDelegate, ARSessionDelegate>

@property (nonatomic, copy) NSString *arMode;
@property (nonatomic, assign) BOOL showGrid;
@property (nonatomic, assign) BOOL showReticle;
@property (nonatomic, assign) BOOL showCalibrationMarkers;
@property (nonatomic, strong) NSDictionary *calibration;
@property (nonatomic, strong) NSDictionary *crosshairPoint;
@property (nonatomic, strong) NSDictionary *blackPoint;
@property (nonatomic, strong) NSDictionary *pinkPoint;
@property (nonatomic, strong) NSDictionary *bluePoint;
@property (nonatomic, strong) NSArray *positionedMarkers;
@property (nonatomic, copy) NSString *selectedMarkerId;

@property (nonatomic, copy) RCTDirectEventBlock onCrosshairPointChange;
@property (nonatomic, copy) RCTDirectEventBlock onCameraPoseChange;
@property (nonatomic, copy) RCTDirectEventBlock onTrackingStateChange;

@end

static const CGFloat kSnookerBallRadiusM = 0.02625;
static const CGFloat kRenderedBallScale = 0.94;
static const CGFloat kRenderedBallRadiusM = kSnookerBallRadiusM * kRenderedBallScale;
static const CGFloat kSelectedMarkerScale = 1.16;
static const CGFloat kBallLiftM = 0.012;

@implementation SnookerARKitView {
  ARSCNView *_sceneView;
  BOOL _hasStarted;
  NSMutableDictionary<NSString *, SCNNode *> *_markerNodes;
  SCNNode *_blackNode;
  SCNNode *_pinkNode;
  SCNNode *_blueNode;
  SCNNode *_reticleNode;
}

- (instancetype)initWithFrame:(CGRect)frame {
  if ((self = [super initWithFrame:frame])) {
    NSLog(@"[SnookerARKit] SnookerARKitView init");
    _sceneView = [[ARSCNView alloc] initWithFrame:CGRectZero];
    _sceneView.delegate = self;
    _sceneView.session.delegate = self;
    _sceneView.automaticallyUpdatesLighting = YES;
    _sceneView.scene = [SCNScene scene];
    [self addSubview:_sceneView];
    _arMode = @"live";
    _markerNodes = [NSMutableDictionary new];
    _showReticle = YES;
  }
  return self;
}

- (void)dealloc {
  [_sceneView.session pause];
}

- (void)layoutSubviews {
  [super layoutSubviews];
  _sceneView.frame = self.bounds;
  if (!_hasStarted) {
    _hasStarted = YES;
    [self runSession];
  }
}

- (void)runSession {
  if (![ARWorldTrackingConfiguration isSupported]) {
    NSLog(@"[SnookerARKit] ARWorldTrackingConfiguration is not supported on this device");
    return;
  }

  ARWorldTrackingConfiguration *config = [ARWorldTrackingConfiguration new];
  config.worldAlignment = ARWorldAlignmentGravity;
  config.planeDetection = ARPlaneDetectionHorizontal;

  if (@available(iOS 13.0, *)) {
    if ([ARWorldTrackingConfiguration supportsFrameSemantics:ARFrameSemanticSceneDepth]) {
      config.frameSemantics = ARFrameSemanticSceneDepth;
    }
  }

  [_sceneView.session runWithConfiguration:config options:(ARSessionRunOptionResetTracking | ARSessionRunOptionRemoveExistingAnchors)];
  NSLog(@"[SnookerARKit] ARSession started (planeDetection=horizontal)");
}

- (SCNVector3)vectorFromPointDict:(NSDictionary *)point {
  return SCNVector3Make([point[@"x"] floatValue], [point[@"y"] floatValue], [point[@"z"] floatValue]);
}

- (SCNVector3)vectorFromPointDict:(NSDictionary *)point liftedBy:(CGFloat)lift {
  return SCNVector3Make([point[@"x"] floatValue], [point[@"y"] floatValue] + lift, [point[@"z"] floatValue]);
}

- (SCNNode *)makeSphereNodeWithRadius:(CGFloat)radius color:(UIColor *)color {
  SCNSphere *geometry = [SCNSphere sphereWithRadius:radius];
  geometry.segmentCount = 24;
  geometry.firstMaterial.diffuse.contents = color;
  geometry.firstMaterial.lightingModelName = SCNLightingModelPhysicallyBased;

  SCNNode *node = [SCNNode nodeWithGeometry:geometry];
  node.castsShadow = YES;
  return node;
}

- (UIColor *)colorForMarker:(NSString *)colorName {
  if ([colorName isEqualToString:@"white"]) return [UIColor whiteColor];
  if ([colorName isEqualToString:@"yellow"]) return [UIColor colorWithRed:0.97 green:0.82 blue:0.24 alpha:1.0];
  if ([colorName isEqualToString:@"green"]) return [UIColor colorWithRed:0.18 green:0.64 blue:0.28 alpha:1.0];
  if ([colorName isEqualToString:@"brown"]) return [UIColor colorWithRed:0.53 green:0.35 blue:0.20 alpha:1.0];
  if ([colorName isEqualToString:@"blue"]) return [UIColor colorWithRed:0.19 green:0.45 blue:0.94 alpha:1.0];
  if ([colorName isEqualToString:@"pink"]) return [UIColor colorWithRed:0.96 green:0.50 blue:0.67 alpha:1.0];
  if ([colorName isEqualToString:@"black"]) return [UIColor colorWithWhite:0.08 alpha:1.0];
  return [UIColor colorWithRed:0.83 green:0.13 blue:0.11 alpha:1.0];
}

- (void)updateReticleNode {
  if (!_showReticle || !self.crosshairPoint) {
    [_reticleNode removeFromParentNode];
    _reticleNode = nil;
    return;
  }

  if (!_reticleNode) {
    _reticleNode = [self makeSphereNodeWithRadius:kRenderedBallRadiusM color:[UIColor colorWithRed:0.17 green:0.89 blue:0.78 alpha:0.4]];
    [_sceneView.scene.rootNode addChildNode:_reticleNode];
  }

  _reticleNode.position = [self vectorFromPointDict:self.crosshairPoint liftedBy:kBallLiftM];
}

- (SCNNode *)updateAnchorPointNode:(SCNNode *)node point:(NSDictionary *)point color:(UIColor *)color radius:(CGFloat)radius {
  if (!point) {
    [node removeFromParentNode];
    return nil;
  }

  if (!node) {
    node = [self makeSphereNodeWithRadius:radius color:color];
    [_sceneView.scene.rootNode addChildNode:node];
  }

  node.position = [self vectorFromPointDict:point];
  return node;
}

- (void)refreshMarkerNodes {
  NSArray *markers = self.positionedMarkers ?: @[];
  NSMutableSet<NSString *> *seenIds = [NSMutableSet setWithCapacity:markers.count];

  for (id rawMarker in markers) {
    if (![rawMarker isKindOfClass:[NSDictionary class]]) continue;
    NSDictionary *marker = (NSDictionary *)rawMarker;
    NSString *markerId = marker[@"id"];
    if (![markerId isKindOfClass:[NSString class]] || markerId.length == 0) continue;

    [seenIds addObject:markerId];

    BOOL isSelected = self.selectedMarkerId && [self.selectedMarkerId isEqualToString:markerId];
    SCNNode *node = _markerNodes[markerId];
    if (!node) {
      UIColor *ballColor = [self colorForMarker:marker[@"color"] ?: @"red"];
      CGFloat radius = isSelected ? (kRenderedBallRadiusM * kSelectedMarkerScale) : kRenderedBallRadiusM;
      node = [self makeSphereNodeWithRadius:radius color:ballColor];
      _markerNodes[markerId] = node;
      [_sceneView.scene.rootNode addChildNode:node];
    } else {
      CGFloat radius = isSelected ? (kRenderedBallRadiusM * kSelectedMarkerScale) : kRenderedBallRadiusM;
      SCNSphere *geometry = [SCNSphere sphereWithRadius:radius];
      geometry.segmentCount = 24;
      geometry.firstMaterial.diffuse.contents = [self colorForMarker:marker[@"color"] ?: @"red"];
      geometry.firstMaterial.lightingModelName = SCNLightingModelPhysicallyBased;
      node.geometry = geometry;
    }

    node.position = [self vectorFromPointDict:marker liftedBy:kBallLiftM];
    node.opacity = isSelected ? 1.0 : 0.88;
  }

  NSArray<NSString *> *existingIds = [_markerNodes allKeys];
  for (NSString *existingId in existingIds) {
    if (![seenIds containsObject:existingId]) {
      [_markerNodes[existingId] removeFromParentNode];
      [_markerNodes removeObjectForKey:existingId];
    }
  }
}

- (void)setShowReticle:(BOOL)showReticle {
  _showReticle = showReticle;
  [self updateReticleNode];
}

- (void)setCrosshairPoint:(NSDictionary *)crosshairPoint {
  _crosshairPoint = crosshairPoint;
  [self updateReticleNode];
}

- (void)setBlackPoint:(NSDictionary *)blackPoint {
  _blackPoint = blackPoint;
  _blackNode = [self updateAnchorPointNode:_blackNode point:_blackPoint color:[UIColor colorWithWhite:0.08 alpha:1.0] radius:kRenderedBallRadiusM];
  if (_blackNode) {
    _blackNode.position = [self vectorFromPointDict:_blackPoint liftedBy:kBallLiftM];
  }
}

- (void)setPinkPoint:(NSDictionary *)pinkPoint {
  _pinkPoint = pinkPoint;
  _pinkNode = [self updateAnchorPointNode:_pinkNode point:_pinkPoint color:[UIColor colorWithRed:0.96 green:0.50 blue:0.67 alpha:1.0] radius:kRenderedBallRadiusM];
  if (_pinkNode) {
    _pinkNode.position = [self vectorFromPointDict:_pinkPoint liftedBy:kBallLiftM];
  }
}

- (void)setBluePoint:(NSDictionary *)bluePoint {
  _bluePoint = bluePoint;
  _blueNode = [self updateAnchorPointNode:_blueNode point:_bluePoint color:[UIColor colorWithRed:0.19 green:0.45 blue:0.94 alpha:1.0] radius:kRenderedBallRadiusM];
  if (_blueNode) {
    _blueNode.position = [self vectorFromPointDict:_bluePoint liftedBy:kBallLiftM];
  }
}

- (void)setPositionedMarkers:(NSArray *)positionedMarkers {
  _positionedMarkers = positionedMarkers;
  [self refreshMarkerNodes];
}

- (void)setSelectedMarkerId:(NSString *)selectedMarkerId {
  _selectedMarkerId = selectedMarkerId;
  [self refreshMarkerNodes];
}

- (void)renderer:(id<SCNSceneRenderer>)renderer updateAtTime:(NSTimeInterval)time {
  ARFrame *frame = _sceneView.session.currentFrame;
  if (!frame) return;

  matrix_float4x4 t = frame.camera.transform;
  float positionX = t.columns[3].x;
  float positionY = t.columns[3].y;
  float positionZ = t.columns[3].z;
  float forwardX = -t.columns[2].x;
  float forwardZ = -t.columns[2].z;

  if (self.onCameraPoseChange) {
    dispatch_async(dispatch_get_main_queue(), ^{
      self.onCameraPoseChange(@{
        @"positionX": @(positionX),
        @"positionY": @(positionY),
        @"positionZ": @(positionZ),
        @"forwardX": @(forwardX),
        @"forwardZ": @(forwardZ),
      });
    });
  }

  if (@available(iOS 13.0, *)) {
    CGPoint center = CGPointMake(CGRectGetMidX(_sceneView.bounds), CGRectGetMidY(_sceneView.bounds));
    ARRaycastQuery *query = [_sceneView raycastQueryFromPoint:center allowingTarget:ARRaycastTargetExistingPlaneGeometry alignment:ARRaycastTargetAlignmentHorizontal];
    if (!query) {
      query = [_sceneView raycastQueryFromPoint:center allowingTarget:ARRaycastTargetExistingPlaneInfinite alignment:ARRaycastTargetAlignmentHorizontal];
    }
    if (!query) {
      query = [_sceneView raycastQueryFromPoint:center allowingTarget:ARRaycastTargetEstimatedPlane alignment:ARRaycastTargetAlignmentHorizontal];
    }
    if (!query) return;
    NSArray<ARRaycastResult *> *hits = [_sceneView.session raycast:query];
    ARRaycastResult *first = hits.firstObject;
    if (!first || !self.onCrosshairPointChange) return;

    matrix_float4x4 hitT = first.worldTransform;
    float x = hitT.columns[3].x;
    float y = hitT.columns[3].y;
    float z = hitT.columns[3].z;

    dispatch_async(dispatch_get_main_queue(), ^{
      self.onCrosshairPointChange(@{
        @"x": @(x),
        @"y": @(y),
        @"z": @(z),
      });
    });
  }
}

- (void)session:(ARSession *)session cameraDidChangeTrackingState:(ARCamera *)camera {
  if (!self.onTrackingStateChange) return;
  NSString *state = @"unavailable";

  switch (camera.trackingState) {
    case ARTrackingStateNormal:
      state = @"normal";
      break;
    case ARTrackingStateLimited:
      state = @"limited";
      break;
    case ARTrackingStateNotAvailable:
      state = @"unavailable";
      break;
  }

  self.onTrackingStateChange(@{ @"state": state });
}

- (void)session:(ARSession *)session didFailWithError:(NSError *)error {
  NSLog(@"[SnookerARKit] ARSession failed: %@", error.localizedDescription);
}

@end

@interface SnookerARKitViewManager : RCTViewManager
@end

@implementation SnookerARKitViewManager

RCT_EXPORT_MODULE(SnookerARKitView)

+ (BOOL)requiresMainQueueSetup {
  NSLog(@"[SnookerARKit] SnookerARKitViewManager requiresMainQueueSetup");
  return YES;
}

- (UIView *)view {
  NSLog(@"[SnookerARKit] SnookerARKitViewManager creating view instance");
  return [SnookerARKitView new];
}

RCT_EXPORT_VIEW_PROPERTY(arMode, NSString)
RCT_EXPORT_VIEW_PROPERTY(showGrid, BOOL)
RCT_EXPORT_VIEW_PROPERTY(showReticle, BOOL)
RCT_EXPORT_VIEW_PROPERTY(showCalibrationMarkers, BOOL)
RCT_EXPORT_VIEW_PROPERTY(calibration, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(crosshairPoint, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(blackPoint, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(pinkPoint, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(bluePoint, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(positionedMarkers, NSArray)
RCT_EXPORT_VIEW_PROPERTY(selectedMarkerId, NSString)

RCT_EXPORT_VIEW_PROPERTY(onCrosshairPointChange, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onCameraPoseChange, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onTrackingStateChange, RCTDirectEventBlock)

@end
