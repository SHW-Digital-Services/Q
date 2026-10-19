import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { roleGroupCourses, getRoleGroupLessons } from '../src/components/roleGroupTrainingData.ts';
const { FileBlob, PresentationFile } = await import(pathToFileURL('C:\\Users\\ScottHarvey-Whittle\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\node_modules\\@oai\\artifact-tool\\dist\\artifact_tool.mjs').href);
const template='E:/dev/Q-Social-Media-Manager/output/Q Social Media Officer Induction with Facilitator Notes.pptx';
await fs.mkdir('.build_it/group-decks',{recursive:true});
for (const course of roleGroupCourses) {
  const p=await PresentationFile.importPptx(await FileBlob.load(template));
  p.slides.keep(Array.from({length:12},(_,i)=>i));
  const content=getRoleGroupLessons(course);
  if(p.slides.items.length!==12||content.length!==11) throw new Error(`Unexpected slide count for ${course.title}`);
  const snap=await p.inspect({kind:'textbox,notes',maxChars:1000000});
  const records=snap.ndjson.split('\n').filter(Boolean).map(x=>JSON.parse(x));
  const boxes=records.filter(x=>x.kind==='textbox'); const notes=records.filter(x=>x.kind==='notes');
  const first=boxes.filter(x=>x.slideIndex===0); if(first.length!==3) throw new Error('Missing cover textboxes');
  const cover=first.map(x=>p.resolve(x.id)); cover[0].text.replace(first[0].text,`${course.title}\nTraining`); cover[1].text.replace(first[1].text,`A practical introduction to the ${course.title.toLowerCase()} roles at Q.`); cover[2].text.replace(first[2].text,'Q Intelligence');
  const coverNote=notes.find(x=>x.slideIndex===0); if(!coverNote) throw new Error('Missing cover notes'); p.resolve(coverNote.id).text.replace(coverNote.text,`Discussion points:\n• Welcome learners from across ${course.title} and explain how their work contributes to Q.\n• Ask learners to identify their role and what they hope to learn.\n\nActivity:\n• Each learner names one responsibility they own and one colleague or group they work with. Keep examples free of private information.`);
  for(let i=0;i<11;i++) {
    const slideIndex=i+1, item=content[i], bs=boxes.filter(x=>x.slideIndex===slideIndex);
    if(bs.length!==4) throw new Error(`Unexpected text layout on ${course.title}, slide ${slideIndex+1}`);
    const ts=bs.map(x=>p.resolve(x.id));
    ts[0].text.replace(bs[0].text,item.title); ts[1].text.replace(bs[1].text,item.summary); ts[2].text.replace(bs[2].text,item.points.join('\n')); ts[3].text.replace(bs[3].text,`Q Intelligence · ${course.title} Training`);
    const n=notes.find(x=>x.slideIndex===slideIndex); if(!n) throw new Error(`Missing notes for ${course.title}, slide ${slideIndex+1}`);
    p.resolve(n.id).text.replace(n.text,`Discussion points:\n${item.discussion.map(point=>`• ${point}`).join('\n')}\n\nActivity:\n• ${item.activity}`);
  }
  const draft=path.resolve(`.build_it/group-decks/${course.key}.pptx`); await (await PresentationFile.exportPptx(p)).save(draft);
  console.log(`Created ${draft}`);
}
