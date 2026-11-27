// Preview edits remain separate from the settings applied to the desktop.
export class SettingsDraft {
 constructor(settings){this.saved=structuredClone(settings);this.draft=structuredClone(settings);this.saving=false}
 get dirty(){return JSON.stringify(this.draft)!==JSON.stringify(this.saved)}
 discard(){if(!this.saving)this.draft=structuredClone(this.saved)}
 async save(persist){
  if(this.saving||!this.dirty)return false;
  const snapshot=structuredClone(this.draft),previous=structuredClone(this.saved);
  this.saving=true;
  try{await persist(snapshot,previous);this.saved=snapshot;return true}
  finally{this.saving=false}
 }
}
