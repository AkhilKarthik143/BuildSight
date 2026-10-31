declare module 'js-aruco2' {
  type ArucoApi = {
    Detector: new (options: {dictionaryName:string;maxHammingDistance?:number}) => {detect(frame:{width:number;height:number;data:Uint8ClampedArray}): {id:number;corners:{x:number;y:number}[];hammingDistance?:number}[]};
    Dictionary: new (name:string) => {generateSVG(id:number):string};
  };
  const aruco: {AR: ArucoApi};
  export default aruco;
}
