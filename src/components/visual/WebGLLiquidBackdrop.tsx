"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export function WebGLLiquidBackdrop(props: { audioLevel: number; active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef(0);
  const active = props.active ?? true;

  const shaders = useMemo(() => {
    const vertex = /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragment = /* glsl */ `
      precision highp float;
      varying vec2 vUv;

      uniform float uTime;
      uniform vec2 uResolution;
      uniform vec2 uPointer;
      uniform float uAudio;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) {
          v += a * noise(p);
          p *= 2.02;
          a *= 0.5;
        }
        return v;
      }

      vec3 palette(float t) {
        vec3 a = vec3(0.94, 0.96, 0.99);
        vec3 b = vec3(0.20, 0.55, 1.00);
        vec3 c = vec3(0.95, 0.25, 0.65);
        vec3 d = vec3(0.75, 0.92, 0.45);
        return a + b * cos(6.28318 * (c * t + d));
      }

      float blob(vec2 p, vec2 c, float r) {
        float d = length(p - c);
        return exp(-d * d / (r * r));
      }

      void main() {
        vec2 uv = vUv;
        vec2 p = (uv - 0.5);
        p.x *= uResolution.x / uResolution.y;

        float t = uTime * (0.65 + uAudio * 1.35);

        vec2 pointer = (uPointer - 0.5);
        pointer.x *= uResolution.x / uResolution.y;

        vec2 q = p;
        float n = fbm(q * 1.4 + vec2(0.0, t * 0.1));
        q += (n - 0.5) * 0.22;

        float a = 0.0;
        a += blob(q, vec2(sin(t * 0.7) * 0.55, cos(t * 0.6) * 0.35), 0.62);
        a += blob(q, vec2(cos(t * 0.5) * 0.45, sin(t * 0.8) * 0.55), 0.58);
        a += blob(q, vec2(sin(t * 0.4 + 1.7) * 0.25, cos(t * 0.7 + 2.0) * 0.55), 0.52);
        a += blob(q, pointer * 0.85, 0.42 + uAudio * 0.18);

        float field = smoothstep(0.65, 1.25, a);
        float ripples = sin((q.x + q.y + t * 0.35) * 7.0) * 0.04;
        float glow = pow(clamp(a, 0.0, 2.0), 1.25) * (0.32 + uAudio * 0.28);

        float shade = field + glow + ripples;
        float hue = fbm(q * 1.2 + t * 0.08) + shade * 0.55;

        vec3 col = palette(hue);
        col = mix(col, vec3(1.0), 0.35 - shade * 0.22);
        col += vec3(0.25, 0.35, 0.55) * glow;

        float vignette = smoothstep(1.2, 0.2, length(p));
        col *= vignette;

        // Grain
        float g = hash(uv * uResolution + fract(t) * 13.37);
        col += (g - 0.5) * 0.04;

        gl_FragColor = vec4(col, 1.0);
      }
    `;
    return { vertex, fragment };
  }, []);

  useEffect(() => {
    audioRef.current = props.audioLevel;
  }, [props.audioLevel]);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (typeof window === "undefined") return;

    let disposed = false;
    const canvas = canvasRef.current;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const uniforms = {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uPointer: { value: new THREE.Vector2(0.5, 0.5) },
      uAudio: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: shaders.vertex,
      fragmentShader: shaders.fragment,
      uniforms,
      depthWrite: false,
      depthTest: false,
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(w * dpr, h * dpr);
    }

    function onPointerMove(evt: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const x = (evt.clientX - rect.left) / rect.width;
      const y = 1.0 - (evt.clientY - rect.top) / rect.height;
      uniforms.uPointer.value.set(x, y);
    }

    let raf = 0;
    const start = performance.now();

    function tick() {
      if (disposed) return;
      raf = window.requestAnimationFrame(tick);

      const now = performance.now();
      uniforms.uTime.value = (now - start) / 1000;
      const target = active ? audioRef.current : 0;
      uniforms.uAudio.value = THREE.MathUtils.lerp(uniforms.uAudio.value, target, 0.12);
      renderer.render(scene, camera);
    }

    resize();
    tick();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    return () => {
      disposed = true;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [shaders.fragment, shaders.vertex, active]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 -z-10 h-full w-full opacity-80"
      aria-hidden="true"
    />
  );
}
