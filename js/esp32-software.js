/* Renderização das mesmas malhas 3D, com buffer de profundidade, sem exigir GPU.
 * WebGL continua sendo a primeira opção para materiais e sombras completos.
 */
(() => {
  'use strict';
  const T=window.THREE;if(!T)return;
  class SoftwareRenderer {
    constructor(canvas){this.domElement=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw new Error('Canvas indisponível.');this.ratio=1;this.shadowMap={enabled:false};this.isSoftwareRenderer=true;this.textures=new WeakMap();}
    setPixelRatio(){this.ratio=1;}
    setSize(w,h){const ratio=Math.min(1,960/w);w=Math.max(2,Math.round(w*ratio));h=Math.max(2,Math.round(h*ratio));if(this.domElement.width!==w||this.domElement.height!==h){this.domElement.width=w;this.domElement.height=h;this.frame=this.ctx.createImageData(w,h);this.depth=new Float32Array(w*h);}}
    render(scene,camera){
      const ctx=this.ctx,w=this.domElement.width,h=this.domElement.height;if(!this.frame)this.setSize(w,h);
      const pixels=this.frame.data,depth=this.depth;pixels.fill(0);depth.fill(Infinity);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
      const projection=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse),matrix=new T.Matrix4(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),normal=new T.Vector3(),light=new T.Vector3(-.4,.85,.5).normalize();
      const texture=image=>{if(this.textures.has(image))return this.textures.get(image);let canvas=image;if(!image.getContext){canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);}const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);this.textures.set(image,data);return data;};
      scene.traverseVisible(node=>{
        if(!node.isMesh||node.material?.type==='ShadowMaterial')return;
        const geo=node.geometry,pos=geo.attributes.position,uv=geo.attributes.uv,index=geo.index;if(!pos)return;matrix.multiplyMatrices(projection,node.matrixWorld);
        const count=index?index.count:pos.count;
        for(let i=0;i<count;i+=3){
          const ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),p=ids.map(id=>{const v=new T.Vector4(pos.getX(id),pos.getY(id),pos.getZ(id),1).applyMatrix4(matrix);return{x:(v.x/v.w*.5+.5)*w,y:(-.5*v.y/v.w+.5)*h,z:v.z/v.w,iw:1/v.w};});if(p.some(v=>v.z>1||v.z< -1))continue;
          const area=(p[1].x-p[0].x)*(p[2].y-p[0].y)-(p[1].y-p[0].y)*(p[2].x-p[0].x);
          let mat=node.material;if(Array.isArray(mat)){const group=geo.groups.find(g=>i>=g.start&&i<g.start+g.count);mat=mat[group?.materialIndex||0];}
          if(!mat||!mat.visible||Math.abs(area)<.02||(mat.side!==T.DoubleSide&&area>0))continue;
          a.fromBufferAttribute(pos,ids[0]).applyMatrix4(node.matrixWorld);b.fromBufferAttribute(pos,ids[1]).applyMatrix4(node.matrixWorld);c.fromBufferAttribute(pos,ids[2]).applyMatrix4(node.matrixWorld);normal.subVectors(b,a).cross(c.sub(a)).normalize();
          const intensity=.48+.5*Math.max(0,normal.dot(light)),color=mat.color||new T.Color('#526777'),emissive=mat.emissive||new T.Color(0),glow=mat.emissiveIntensity||0;
          const rgb=[color.r,color.g,color.b].map((v,k)=>Math.round(Math.min(1,Math.sqrt(Math.max(0,v))*intensity+[emissive.r,emissive.g,emissive.b][k]*glow*.4)*255));
          const image=mat.map?.image?texture(mat.map.image):null,uvs=image&&uv?ids.map(id=>({u:uv.getX(id),v:uv.getY(id)})):null;
          const minX=Math.max(0,Math.floor(Math.min(...p.map(v=>v.x)))),maxX=Math.min(w-1,Math.ceil(Math.max(...p.map(v=>v.x)))),minY=Math.max(0,Math.floor(Math.min(...p.map(v=>v.y)))),maxY=Math.min(h-1,Math.ceil(Math.max(...p.map(v=>v.y))));
          const den=(p[1].y-p[2].y)*(p[0].x-p[2].x)+(p[2].x-p[1].x)*(p[0].y-p[2].y);if(!den)continue;
          for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
            const aa=((p[1].y-p[2].y)*(x+.5-p[2].x)+(p[2].x-p[1].x)*(y+.5-p[2].y))/den;if(aa<0)continue;
            const bb=((p[2].y-p[0].y)*(x+.5-p[2].x)+(p[0].x-p[2].x)*(y+.5-p[2].y))/den,cc=1-aa-bb;if(bb<0||cc<0)continue;
            const z=aa*p[0].z+bb*p[1].z+cc*p[2].z,offset=y*w+x;if(z>=depth[offset])continue;let r=rgb[0],g=rgb[1],b=rgb[2],alpha=255;
            if(image&&uvs){const weight=aa*p[0].iw+bb*p[1].iw+cc*p[2].iw,u=(aa*uvs[0].u*p[0].iw+bb*uvs[1].u*p[1].iw+cc*uvs[2].u*p[2].iw)/weight,v=(aa*uvs[0].v*p[0].iw+bb*uvs[1].v*p[1].iw+cc*uvs[2].v*p[2].iw)/weight;const tx=Math.max(0,Math.min(image.width-1,Math.floor(u*image.width))),ty=Math.max(0,Math.min(image.height-1,Math.floor((1-v)*image.height))),k=(ty*image.width+tx)*4;r=image.data[k];g=image.data[k+1];b=image.data[k+2];alpha=image.data[k+3];if(alpha<32)continue;}
            const k=offset*4;depth[offset]=z;pixels[k]=r;pixels[k+1]=g;pixels[k+2]=b;pixels[k+3]=alpha;
          }
        }
      });
      scene.traverseVisible(node=>{
        if(!node.isLineSegments)return;const position=node.geometry.attributes.position,colors=node.geometry.attributes.color;
        matrix.multiplyMatrices(projection,node.matrixWorld);
        for(let i=0;i<position.count;i+=2){
          const points=[i,i+1].map(id=>new T.Vector3().fromBufferAttribute(position,id).applyMatrix4(matrix));if(points.some(p=>p.z< -1||p.z>1))continue;
          const x1=(points[0].x*.5+.5)*w,y1=(-points[0].y*.5+.5)*h,x2=(points[1].x*.5+.5)*w,y2=(-points[1].y*.5+.5)*h;
          const steps=Math.max(1,Math.ceil(Math.max(Math.abs(x2-x1),Math.abs(y2-y1))));
          for(let k=0;k<=steps;k++){const t=k/steps,x=Math.round(x1+(x2-x1)*t),y=Math.round(y1+(y2-y1)*t);if(x<0||x>=w||y<0||y>=h)continue;const offset=y*w+x,z=points[0].z+(points[1].z-points[0].z)*t;if(z>=depth[offset])continue;const j=offset*4;pixels[j]=colors?colors.getX(i)*255:40;pixels[j+1]=colors?colors.getY(i)*255:68;pixels[j+2]=colors?colors.getZ(i)*255:80;pixels[j+3]=180;}
        }
      });ctx.putImageData(this.frame,0,0);
    }
    dispose(){this.ctx.clearRect(0,0,this.domElement.width,this.domElement.height);this.frame=null;this.depth=null;}
  }
  window.CodaESPSoftwareRenderer=SoftwareRenderer;
})();
