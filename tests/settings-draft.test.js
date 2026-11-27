import test from 'node:test';
import assert from 'node:assert/strict';
import {SettingsDraft} from '../src/settings-draft.js';
import {normalize} from '../src/config.js';

test('aparência e seleção do pet só são persistidas ao salvar explicitamente',async()=>{
 const original=normalize(),editor=new SettingsDraft(original);
 let persisted=structuredClone(original),writes=0;
 editor.draft.pets.cat.coat='#112233';
 editor.draft.desktop.cat.enabled=false;editor.draft.desktop.dog.enabled=true;
 assert.equal(editor.dirty,true);assert.equal(writes,0);
 assert.equal(persisted.pets.cat.coat,original.pets.cat.coat);assert.equal(persisted.desktop.cat.enabled,true);
 await editor.save(async snapshot=>{persisted=structuredClone(snapshot);writes++});
 assert.equal(writes,1);assert.equal(persisted.pets.cat.coat,'#112233');
 assert.equal(persisted.desktop.cat.enabled,false);assert.equal(persisted.desktop.dog.enabled,true);assert.equal(editor.dirty,false);
 const reopened=new SettingsDraft(persisted);assert.equal(reopened.draft.desktop.dog.enabled,true);
});

test('descartar restaura as duas aparências e o animal ativo sem escrever',()=>{
 const original=normalize(),editor=new SettingsDraft(original);
 editor.draft.pets.cat.coat='#111111';editor.draft.pets.dog.coat='#222222';
 editor.draft.desktop.cat.enabled=false;editor.draft.desktop.dog.enabled=true;
 editor.draft.autostart=true;editor.discard();
 assert.deepEqual(editor.draft,original);assert.equal(editor.dirty,false);
});

test('falha ao salvar mantém as alterações disponíveis para tentar novamente',async()=>{
 const editor=new SettingsDraft(normalize());editor.draft.pets.cat.coat='#112233';
 await assert.rejects(editor.save(async()=>{throw Error('Falha de gravação')}),/Falha de gravação/);
 assert.equal(editor.saving,false);assert.equal(editor.dirty,true);assert.equal(editor.draft.pets.cat.coat,'#112233');
 await editor.save(async()=>{});assert.equal(editor.dirty,false);
});

test('edições feitas durante o salvamento permanecem pendentes e não geram gravações concorrentes',async()=>{
 const editor=new SettingsDraft(normalize());let finish,persisted;
 editor.draft.pets.cat.coat='#112233';
 const saving=editor.save(snapshot=>{persisted=snapshot;return new Promise(resolve=>{finish=resolve})});
 assert.equal(editor.saving,true);
 editor.draft.pets.cat.coat='#445566';editor.draft.desktop.dog.enabled=true;
 assert.equal(await editor.save(()=>{throw Error('Não deve gravar duas vezes')}),false);
 editor.discard();assert.equal(editor.draft.pets.cat.coat,'#445566');
 finish();await saving;
 assert.equal(persisted.pets.cat.coat,'#112233');assert.equal(persisted.desktop.dog.enabled,false);assert.equal(editor.dirty,true);
 editor.discard();assert.equal(editor.draft.pets.cat.coat,'#112233');assert.equal(editor.draft.desktop.dog.enabled,false);
});
