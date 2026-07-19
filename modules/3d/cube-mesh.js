// Cube Mesh - Cubie, core, and sticker mesh creation/destruction
// Module:    CubeMesh
// Version:   2.0.0
// Ported from Clark's rendering: flat plane stickers, glossy finish,
// tighter gaps, adjusted colors, subtle edge lines.

(function() {
'use strict';

function CubeMesh(options) {
  options = options || {};
  this.cube = options.cube || null;
  this.cubieSize = options.cubieSize || 0.85;
  this.gap = options.gap || 0.04;
  this._spacing = this.cubieSize + this.gap;
  this.stickerSize = this.cubieSize * 0.85;
  this.stickerGeo = new THREE.PlaneGeometry(this.stickerSize, this.stickerSize);
  this.coreColor = options.coreColor || 0x111111;
  this.coreMat = new THREE.MeshStandardMaterial({color:this.coreColor, roughness:0.4, metalness:0.1});
  this._colors = [0xFFFFFF, 0xFFD500, 0x009E60, 0x0051BA, 0xFF5800, 0xC41E3A, 0x222222];
  this._stickerMeshes = [];
  this._cubieCores = [];
}

Object.defineProperty(CubeMesh.prototype, 'stickerMeshes', {get:function(){return this._stickerMeshes;}});
Object.defineProperty(CubeMesh.prototype, 'cubieCores', {get:function(){return this._cubieCores;}});

CubeMesh.prototype._getStickerMaterial = function(colorIdx) {
  return new THREE.MeshStandardMaterial({
    color: this._colors[colorIdx] || 0x222222,
    roughness: 0.15,
    metalness: 0.4,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });
};

CubeMesh.prototype.build = function(cubeGroup) {
  var g = cubeGroup;
  this._stickerMeshes = [];
  this._cubieCores = [];
  if (!this.cube) return;
  var state = this.cube.state;
  var get = function(r,c,f){return state[f*9+r*3+c];};
  var spacing = this._spacing;
  var half = this.cubieSize / 2;
  var faceConfig = [
    {axis:'x',sign:1,colorIdx:5,rotY:Math.PI/2},
    {axis:'x',sign:-1,colorIdx:4,rotY:-Math.PI/2},
    {axis:'y',sign:1,colorIdx:0,rotX:-Math.PI/2},
    {axis:'y',sign:-1,colorIdx:1,rotX:Math.PI/2},
    {axis:'z',sign:1,colorIdx:2,rotY:0},
    {axis:'z',sign:-1,colorIdx:3,rotY:Math.PI}
  ];
  for(var x=-1;x<=1;x++){
    for(var y=-1;y<=1;y++){
      for(var z=-1;z<=1;z++){
        var cubie=new THREE.Group();
        cubie.userData={isCubieGroup:true};
        cubie.position.set(x*spacing,y*spacing,z*spacing);
        var core=new THREE.Mesh(new THREE.BoxGeometry(this.cubieSize,this.cubieSize,this.cubieSize),this.coreMat);
        core.castShadow=true;
        core.userData={isCore:true};
        cubie.add(core);
        this._cubieCores.push(core);
        var facelets={
          'px':{f:5,r:1-y,c:1-z,ext:x===1},
          'nx':{f:4,r:1-y,c:z+1,ext:x===-1},
          'py':{f:0,r:z+1,c:x+1,ext:y===1},
          'ny':{f:1,r:1-z,c:x+1,ext:y===-1},
          'pz':{f:2,r:1-y,c:x+1,ext:z===1},
          'nz':{f:3,r:1-y,c:1-x,ext:z===-1}
        };
        faceConfig.forEach(function(fc){
          var isOuter=(fc.axis==='x'&&Math.abs(x)===1)||(fc.axis==='y'&&Math.abs(y)===1)||(fc.axis==='z'&&Math.abs(z)===1);
          if(!isOuter)return;
          var sign=fc.axis==='x'?x:(fc.axis==='y'?y:z);
          if(Math.sign(sign)!==fc.sign)return;
          var dirKey=(fc.sign===1?'p':'n')+fc.axis;
          var fl=facelets[dirKey];
          if(!fl)return;
          var ci=get(fl.r,fl.c,fl.f);
          var sticker=new THREE.Mesh(this.stickerGeo,this._getStickerMaterial(ci));
          sticker.userData={isSticker:true,isExternal:fl.ext,faceIdx:fl.f,row:fl.r,col:fl.c};
          sticker.castShadow=true;
          var off=half+0.02;
          if(fc.axis==='x'){sticker.position.set(fc.sign*off,0,0);sticker.rotation.y=fc.rotY;}
          else if(fc.axis==='y'){sticker.position.set(0,fc.sign*off,0);sticker.rotation.x=fc.rotX;}
          else if(fc.axis==='z'){sticker.position.set(0,0,fc.sign*off);sticker.rotation.y=fc.rotY;}
          cubie.add(sticker);
          this._stickerMeshes.push(sticker);
        });
        var edges=new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(this.cubieSize,this.cubieSize,this.cubieSize)),
          new THREE.LineBasicMaterial({color:0x222222,transparent:true,opacity:0.2}));
        cubie.add(edges);
        g.add(cubie);
      }
    }
  }
};

CubeMesh.prototype.destroy = function(cubeGroup) {
  var g=cubeGroup, self=this;
  while(g.children.length){var c=g.children[0];
    c.traverse(function(child){
      if(child.geometry&&child.geometry!==self.stickerGeo)child.geometry.dispose();
      if(child.material){if(child.material.map)child.material.map.dispose();child.material.dispose();}
    });g.remove(c);}
  this._stickerMeshes=[];this._cubieCores=[];
};

window.CubeMesh=CubeMesh;
})();
