import * as k from "file:///home/adelpro/.config/opencode/skills/anatomy/kit/iso-kit.mjs";
const P = k.fitProjection([[-118,0,0],[118,0,0],[0,-118,0],[0,118,0],[0,0,30]],620,420,{pad:26,azimuth:40,elevation:33});
const nums=(d)=>d.match(/-?\d+(\.\d+)?/g).map(Number);
const box=(d)=>{const v=nums("M"+d);let xs=[],ys=[];for(let i=0;i<v.length;i+=2){xs.push(v[i]);ys.push(v[i+1]);}return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)].map(n=>Math.round(n));};
for (const deg of [0,120,240]) {
  const a=deg*Math.PI/180, cx=44*Math.cos(a), cy=44*Math.sin(a);
  const u=[Math.cos(a),Math.sin(a)], v=[-Math.sin(a),Math.cos(a)];
  const poly=[[9,5.6],[15,5.6],[18,2.7],[58,2.7],[58,-2.7],[56,-1.3],[54,-2.7],[51,-0.9],[49,-2.7],[46,-1.6],[44,-2.7],[41,-1.0],[39,-2.7],[36,-1.7],[34,-2.7],[30,-2.7],[24,-4.6],[9,-5.6]]
    .map(([pu,pv])=>[cx+u[0]*pu+v[0]*pv, cy+u[1]*pu+v[1]*pv]);
  const s=k.extrude(poly,15,3.6,P,{convex:false,bevel:0.35});
  console.log(deg, "fill len", s.fill.length, "outline bbox", box(s.outline), "top bbox", box(s.top));
}
console.log("viewBox 620x420");
