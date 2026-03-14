/**
 * Expo config plugin that adds a pre-compiled CoreML model (.mlmodelc)
 * and native Swift/ObjC source files to the Xcode project.
 * Also configures build settings for VisionCamera frame processor compatibility.
 */
const { withXcodeProject } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

function withCoreMLModel(config, { modelPath, nativeSourcesDir }) {
  return withXcodeProject(config, async (config) => {
    const project = config.modResults;
    const projectRoot = config.modRequest.projectRoot;
    const projectName = config.modRequest.projectName;
    const appDir = path.join(projectRoot, 'ios', projectName);
    const appGroupKey = project.findPBXGroupKey({ name: projectName });

    // --- Fix: Allow non-modular headers (needed for VisionCamera + static frameworks) ---
    const buildConfigs = project.hash.project.objects['XCBuildConfiguration'];
    for (const key in buildConfigs) {
      const bc = buildConfigs[key];
      if (typeof bc === 'object' && bc.buildSettings) {
        bc.buildSettings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES';
      }
    }

    // --- 1. Copy pre-compiled CoreML model ---
    if (modelPath) {
      const modelName = path.basename(modelPath);
      const srcModel = path.resolve(projectRoot, modelPath);
      const dstModel = path.join(appDir, modelName);

      if (fs.existsSync(srcModel) && !fs.existsSync(dstModel)) {
        fs.cpSync(srcModel, dstModel, { recursive: true });
      }

      const fileRef = project.generateUuid();
      const buildFile = project.generateUuid();

      project.hash.project.objects['PBXFileReference'][fileRef] = {
        isa: 'PBXFileReference',
        lastKnownFileType: 'folder',
        name: modelName,
        path: `${projectName}/${modelName}`,
        sourceTree: '"<group>"',
      };
      project.hash.project.objects['PBXFileReference'][`${fileRef}_comment`] = modelName;

      if (appGroupKey) {
        const group = project.hash.project.objects['PBXGroup'][appGroupKey];
        if (group && group.children) {
          group.children.push({ value: fileRef, comment: modelName });
        }
      }

      project.hash.project.objects['PBXBuildFile'][buildFile] = {
        isa: 'PBXBuildFile',
        fileRef: fileRef,
        fileRef_comment: modelName,
      };
      project.hash.project.objects['PBXBuildFile'][`${buildFile}_comment`] = `${modelName} in Resources`;

      const nativeTarget = project.getFirstTarget();
      for (const phase of nativeTarget.firstTarget.buildPhases) {
        const phaseObj = project.hash.project.objects['PBXResourcesBuildPhase'][phase.value];
        if (phaseObj) {
          phaseObj.files.push({ value: buildFile, comment: `${modelName} in Resources` });
          break;
        }
      }

      console.log(`[withCoreMLModel] Added ${modelName} to resources`);
    }

    // --- 2. Copy and add native source files ---
    if (nativeSourcesDir) {
      const srcDir = path.resolve(projectRoot, nativeSourcesDir);
      if (fs.existsSync(srcDir)) {
        for (const file of fs.readdirSync(srcDir)) {
          const srcFile = path.join(srcDir, file);
          const dstFile = path.join(appDir, file);

          if (!fs.existsSync(dstFile)) {
            fs.copyFileSync(srcFile, dstFile);
          }

          if (file.endsWith('.swift') || file.endsWith('.m')) {
            const filePath = `${projectName}/${file}`;
            project.addSourceFile(filePath, { target: project.getFirstTarget().uuid }, appGroupKey);
            console.log(`[withCoreMLModel] Added ${file} to sources`);
          }
        }
      }
    }

    // --- 3. Add VisionCamera headers to bridging header ---
    const bridgingHeaderPath = path.join(appDir, `${projectName}-Bridging-Header.h`);
    if (fs.existsSync(bridgingHeaderPath)) {
      let content = fs.readFileSync(bridgingHeaderPath, 'utf8');
      const importLine = '#import <VisionCamera/FrameProcessorPlugin.h>';
      if (!content.includes(importLine)) {
        content += `\n${importLine}\n#import <VisionCamera/FrameProcessorPluginRegistry.h>\n#import <VisionCamera/Frame.h>\n`;
        fs.writeFileSync(bridgingHeaderPath, content);
        console.log('[withCoreMLModel] Updated bridging header with VisionCamera imports');
      }
    }

    return config;
  });
}

module.exports = withCoreMLModel;
