import {expect,type Page} from '@playwright/test'
import initSqlJs, {type Database} from 'sql.js'
import {resolve} from 'node:path'

export const challengeOne='9f1c3a52-0d64-4e2b-8a71-5c0e2b7d4a10'
export async function readDatabase(page:Page):Promise<Database> {
 const SQL=await initSqlJs({locateFile:(file)=>resolve('node_modules/sql.js/dist',file)})
 const bytes=await page.evaluate(()=>new Promise<number[]>((accept,reject)=>{
  const open=indexedDB.open('guard-the-heart',1)
  open.onerror=()=>reject(open.error)
  open.onsuccess=()=>{const db=open.result,tx=db.transaction('sqlite','readonly'),get=tx.objectStore('sqlite').get('database');get.onsuccess=()=>accept(Array.from(new Uint8Array(get.result??[])));get.onerror=()=>reject(get.error);tx.oncomplete=()=>db.close()}
 }))
 return new SQL.Database(new Uint8Array(bytes))
}
export async function seedCards(page:Page,challengeId:string,awards:Array<[string,string]>=[],lowOpponent=false) {
 await page.addInitScript(()=>{Math.random=()=>.2})
 await page.goto(`/admin/tactical/${challengeId}`)
 await expect(page.getByRole('button',{name:'Skip Biru',exact:true})).toBeVisible()
 await expect.poll(async()=>{const db=await readDatabase(page);const count=Number(db.exec('SELECT COUNT(*) FROM card')[0]?.values[0][0]??0);db.close();return count}).toBe(60)
 const db=await readDatabase(page)
 const teams=db.exec('SELECT id,name FROM team ORDER BY name')[0].values
 for (const [index,row] of teams.entries()) {
  db.run('INSERT INTO challenge_point (id,challenge,team,rank,challenge_point,score,guard_power,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,datetime(\'now\'),datetime(\'now\'))',[`point-${index}`,challengeId,String(row[0]),index+1,10-index*2,100-index*10,0])
  db.run('UPDATE team SET total_gp=? WHERE id=?',[lowOpponent&&row[1]==='Hijau'?1:5,String(row[0])])
 }
 if (lowOpponent) {
  const target=String(teams.find((row)=>row[1]==='Hijau')![0])
  db.run("INSERT INTO gp_transaction (id,team,team_name,challenge,challenge_name,source_key,category,gp_before,delta,gp_after,description,createdAt,updatedAt) VALUES ('fixture-low-gp',?,'Hijau',NULL,'','fixture-low-gp','card',7,-6,1,'Low GP test fixture',datetime('now'),datetime('now'))",[target])
 }
 for (const [index,[teamName,name]] of awards.entries()) {
  const teamId=String(teams.find((row)=>row[1]===teamName)![0])
  db.run('UPDATE card SET team=?,challenge=? WHERE name=?',[teamId,challengeId,name])
  db.run('INSERT INTO team_card (id,name,type,effect,effect_action,icon,team,challenge_point,createdAt,updatedAt) SELECT ?,name,type,effect,effect_action,icon,team,challenge_point,createdAt,updatedAt FROM card WHERE name=?',[`owned-${index}`,name])
 }
 const bytes=Array.from(db.export());db.close()
 await page.evaluate((bytes)=>new Promise<void>((accept,reject)=>{const open=indexedDB.open('guard-the-heart',1);open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('sqlite','readwrite');tx.objectStore('sqlite').put(new Uint8Array(bytes),'database');tx.oncomplete=()=>{db.close();accept()};tx.onerror=()=>reject(tx.error)}}),bytes)
 await page.reload()
}
