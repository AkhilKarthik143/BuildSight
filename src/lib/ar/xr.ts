export async function supportsImmersiveAr(navigatorLike: {xr?: {isSessionSupported:(mode:string)=>Promise<boolean>}} | null | undefined): Promise<boolean> {
  try { return !!(await navigatorLike?.xr?.isSessionSupported('immersive-ar')); } catch { return false; }
}
