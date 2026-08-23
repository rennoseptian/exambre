/* ── IMAGE COMPRESSION ── */
async function compressImg(file,maxPx=900,quality=0.78){
  return new Promise(res=>{
    if(file.size>4*1024*1024){showToast('⚠️ Gambar terlalu besar (maks 4MB). Gunakan URL saja.','warn');res(null);return;}
    const img=new Image();
    const url=URL.createObjectURL(file);
    img.onload=()=>{
      const scale=Math.min(1,maxPx/Math.max(img.width,img.height));
      const w=Math.round(img.width*scale),h=Math.round(img.height*scale);
      const c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      res(c.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);res(null);};
    img.src=url;
  });
}
function imgToBase64(file){return compressImg(file);}

/* ── DEFAULT DATA ── */
function defaultQ(){
  return[];
}

