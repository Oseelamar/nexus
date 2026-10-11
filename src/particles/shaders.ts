import { MAX_OBJECTS } from './collections';

// Shared by the simulation and the render pass: the animated target position of
// a particle. Each particle has a local point in the "from" and "to" collection
// (xyz) plus the index of the object it belongs to (w). During a transition the
// particle travels along an eased path between the two live, moving objects,
// lifted off the straight line by a smooth per-particle arc.
export const targetChunk = /* glsl */ `
  uniform sampler2D uFrom;
  uniform sampler2D uTo;
  uniform sampler2D uSeed;
  uniform mat4 uFromM[${MAX_OBJECTS}];
  uniform mat4 uToM[${MAX_OBJECTS}];
  uniform float uMorph;
  uniform float uMorphDur;
  uniform float uStagger;
  uniform float uSpread;

  vec3 targetAt(vec2 uv) {
    vec4 a = texture2D(uFrom, uv);
    vec4 b = texture2D(uTo, uv);
    vec4 s = texture2D(uSeed, uv);
    vec3 pa = (uFromM[int(a.w + 0.5)] * vec4(a.xyz, 1.0)).xyz;
    vec3 pb = (uToM[int(b.w + 0.5)] * vec4(b.xyz, 1.0)).xyz;
    float p = clamp((uMorph - s.x * uStagger) / uMorphDur, 0.0, 1.0);
    float e = p * p * p * (p * (p * 6.0 - 15.0) + 10.0);
    vec3 dir = normalize(s.yzw * 2.0 - 1.0 + vec3(1e-4));
    return mix(pa, pb, e) + dir * sin(3.14159265 * e) * uSpread * (0.45 + 0.55 * s.x);
  }
`;

// Simulation state is the particle's displacement from its target (tOff) and the
// displacement's velocity (tVel). Shapes therefore never smear while they rotate;
// only the cursor pushes particles off their target and a damped spring returns them.
export const velocityShader = /* glsl */ `
  ${targetChunk}
  uniform float uDt;
  uniform vec3 uRayO;
  uniform vec3 uRayD;
  uniform float uCursor;
  uniform vec3 uCursorVel;
  uniform float uRadius;
  uniform float uPush;
  uniform float uDrag;
  uniform float uStiff;
  uniform float uDamp;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 off = texture2D(tOff, uv).xyz;
    vec3 vel = texture2D(tVel, uv).xyz;
    vec4 s = texture2D(uSeed, uv);

    vec3 acc = -off * uStiff - vel * uDamp;

    if (uCursor > 0.001) {
      // Distance to the pointer ray, so the cursor bores through the whole depth
      // of the field instead of acting on a flat image.
      vec3 p = targetAt(uv) + off;
      vec3 v = p - uRayO;
      vec3 o = v - uRayD * dot(v, uRayD);
      float d2 = dot(o, o);
      float f = exp(-d2 / (uRadius * uRadius)) * uCursor * (0.7 + 0.6 * s.y);
      acc += (o * inversesqrt(d2 + 1e-5) + uRayD * 0.35) * f * uPush;
      acc += uCursorVel * f * uDrag;
    }

    vel += acc * uDt;
    float sp = length(vel);
    if (sp > 14.0) vel *= 14.0 / sp;
    gl_FragColor = vec4(vel, 1.0);
  }
`;

export const offsetShader = /* glsl */ `
  uniform float uDt;
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec3 off = texture2D(tOff, uv).xyz;
    vec3 vel = texture2D(tVel, uv).xyz;
    gl_FragColor = vec4(off + vel * uDt, 1.0);
  }
`;

export const pointsVertex = /* glsl */ `
  ${targetChunk}
  uniform sampler2D uOff;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uCamDist;
  attribute vec2 aRef;
  varying float vAlpha;

  void main() {
    vec3 p = targetAt(aRef) + texture2D(uOff, aRef).xyz;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    // Depth cue: nearer particles are slightly larger and brighter, farther ones
    // smaller and dimmer (objects span roughly z = -2.6 … +1.6).
    gl_PointSize = uSize * uPixelRatio * pow(uCamDist / -mv.z, 1.6);
    vAlpha = clamp(0.8 + 0.14 * p.z, 0.42, 1.0);
  }
`;

export const pointsFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (dot(c, c) > 0.25) discard;
    gl_FragColor = vec4(uColor, vAlpha);
  }
`;
