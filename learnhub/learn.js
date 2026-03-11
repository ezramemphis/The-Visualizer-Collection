export function setupSlider(id, callback){
  const slider = document.getElementById(id);
  if(!slider) return;

  slider.addEventListener("input", (e)=>{
    callback(parseFloat(e.target.value));
  });
}