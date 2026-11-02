import { createDetector, type Frame } from './detector';
import { createTracker, estimatePose } from './tracker';
const detector=createDetector(),tracker=createTracker(detector);
self.onmessage=(event:MessageEvent<{id:number;kind:'track'|'anchor';frame:Frame}>)=>{
  const {id,kind,frame}=event.data, started=performance.now();
  try {
    const result=kind==='track'?tracker.update(frame):estimatePose(detector.detect(frame),frame.width,frame.height);
    self.postMessage({id,kind,result,ms:performance.now()-started});
  } catch {self.postMessage({id,kind,error:true});}
};
