const fs = require("fs");
const path = require("path");
const {
  withDangerousMod,
  withXcodeProject,
  createRunOncePlugin,
  IOSConfig,
} = require("@expo/config-plugins");

const PACKAGE_NAME = "with-snooker-arkit";
const PLUGIN_VERSION = "1.0.0";
const FILE_NAME = "SnookerARKitViewManager.m";

function withSnookerARKit(config) {
  config = withDangerousMod(config, ["ios", async (cfg) => {
    const projectRoot = cfg.modRequest.projectRoot;
    const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
    const sourcePath = path.join(projectRoot, "plugins", "ios", FILE_NAME);
    const platformProjectRoot = cfg.modRequest.platformProjectRoot;
    const nativeTargetDir = path.join(platformProjectRoot, projectName);
    const targetPath = path.join(nativeTargetDir, FILE_NAME);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing ARKit source file at ${sourcePath}`);
    }

    if (!fs.existsSync(nativeTargetDir)) {
      throw new Error(`Missing iOS native target directory at ${nativeTargetDir}. Run expo prebuild first.`);
    }

    fs.copyFileSync(sourcePath, targetPath);
    console.log(`[${PACKAGE_NAME}] Copied ${FILE_NAME} -> ios/${projectName}/${FILE_NAME}`);

    return cfg;
  }]);

  config = withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const relativeFilePath = `${projectName}/${FILE_NAME}`;

    const appTarget = IOSConfig.XcodeUtils.getApplicationNativeTarget({
      project,
      projectName,
    });

    try {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
        filepath: relativeFilePath,
        groupName: projectName,
        project,
        targetUuid: appTarget.uuid,
        verbose: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`[${PACKAGE_NAME}] Failed to add ${relativeFilePath} to Xcode sources: ${message}`);
    }

    const linkedFile = project.hasFile(relativeFilePath);
    if (!linkedFile) {
      throw new Error(`[${PACKAGE_NAME}] ${relativeFilePath} was not linked in Xcode project`);
    }

    console.log(`[${PACKAGE_NAME}] Linked ${relativeFilePath} to target ${appTarget.target.name}`);

    return cfg;
  });

  return config;
}

module.exports = createRunOncePlugin(withSnookerARKit, PACKAGE_NAME, PLUGIN_VERSION);
