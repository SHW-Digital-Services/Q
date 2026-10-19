import fs from 'node:fs/promises'; import path from 'node:path'; import {pathToFileURL} from 'node:url';
const {finalizePresentation}=await import(pathToFileURL('C:/Users/ScottHarvey-Whittle/.codex/plugins/cache/openai-primary-runtime/presentations/26.1015.12040/skills/presentations/container_tools/artifact_tool_utils.mjs').href);
const skillDir='C:/Users/ScottHarvey-Whittle/.codex/plugins/cache/openai-primary-runtime/presentations/26.1015.12040/skills/presentations';
const workspaceDir='E:/dev/Q'; const source='E:/dev/Q-Social-Media-Manager/output/Q Social Media Officer Induction with Facilitator Notes.pptx';
const titles={
'leadership-governance':'Leadership & Governance',
'product-design':'Product & Design',
'technology-it':'Technology & IT',
'content-community':'Content & Community',
'customer-platform-support':'Customer & Platform Support',
'data-improvement':'Data & Improvement'
};
for(const [key,title] of Object.entries(titles)) {
 const candidatePath=path.join(workspaceDir,`.build_it/group-decks/${key}.pptx`);
 const finalPath=path.join(workspaceDir,`output/Q Intelligence - ${title} Training.pptx`);
 const receiptPath=path.join(workspaceDir,`.build_it/.codex-finalizer/${key}.validation.json`); await fs.mkdir(path.dirname(receiptPath),{recursive:true});
 const result=await finalizePresentation({explicitTotalSlideCount:12,requiredNativeTableOwnerSlides:[],requiredNativeChartOwnerSlides:[],sourceTemplatePath:source,requiredTemplateReferenceSlides:Array.from({length:12},(_,i)=>i+1),minimumTemplateCoverageRatio:1.0,workspaceDir,candidatePath,finalPath,pythonExecutable:'C:/Users/ScottHarvey-Whittle/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:path.join(skillDir,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skillDir,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy:{basis:'reference',families:['Inter'],referencePath:source,referenceSha256:'0dae938ebefcab1ac76ffec970f2f5cdfe8b568846a7a7282250bdf6613d6b7a'},verifyArtifactToolImport:true,receiptPath});
 console.log(`${title}: ${result.finalPath}`);
}
