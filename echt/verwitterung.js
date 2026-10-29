/**
 * Verwitterung für MeshStandardMaterial: Flecken und ungleichmässiger Lack
 * (Weltraum-Rauschen, keine UVs nötig) sowie Baustellendreck, der vom Boden
 * her nach oben ausläuft – Raupen, Zaunfüsse, Stiefel und Räder werden lehmig.
 * Funktioniert mit normalen und instanzierten Meshes.
 */
const NOISE = /* glsl */`
  varying vec3 vWeatherPos;
  uniform float uDirt;
  float wHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float wNoise(vec3 x){
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(wHash(i), wHash(i + vec3(1,0,0)), f.x), mix(wHash(i + vec3(0,1,0)), wHash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(wHash(i + vec3(0,0,1)), wHash(i + vec3(1,0,1)), f.x), mix(wHash(i + vec3(0,1,1)), wHash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`;

export function verwittern(material, { dirt = 1, grime = 1 } = {}) {
  if (!material?.isMeshStandardMaterial || material.userData.verwittert) return material;
  material.userData.verwittert = true;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous?.call(material, shader, renderer);
    shader.uniforms.uDirt = { value: dirt };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWeatherPos;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 weatherPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          weatherPos = instanceMatrix * weatherPos;
        #endif
        vWeatherPos = (modelMatrix * weatherPos).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wSpots = wNoise(vWeatherPos * 1.6) * .6 + wNoise(vWeatherPos * 7.0) * .4;
        diffuseColor.rgb *= 1.0 + (wSpots - .55) * ${(.22 * grime).toFixed(3)};
        float wBand = 1.0 - smoothstep(.04, .9 + wNoise(vWeatherPos * .9) * .7, vWeatherPos.y);
        float wDirt = wBand * smoothstep(.22, .7, wNoise(vWeatherPos * 2.4 + vec3(3.1, 0.0, 1.7))) * uDirt;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.27, .22, .16), clamp(wDirt * .7, 0.0, .85));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (wSpots - .5) * .18 * ${grime.toFixed(3)} + wDirt * .3, .04, 1.0);`);
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (key ? key() : '') + '|verwitterung-' + grime.toFixed(3);
  material.needsUpdate = true;
  return material;
}
