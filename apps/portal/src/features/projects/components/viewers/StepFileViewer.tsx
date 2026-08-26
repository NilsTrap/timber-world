"use client";

import { useEffect, useRef, useState } from "react";
import { ScanSearch } from "lucide-react";
import { Button } from "@timber/ui";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES } from "../../filePaths";
import { PreviewFailure, PreviewLoading } from "../ProjectFilePreview";
import { PROJECT_PREVIEW_COPY } from "../previewCopy";
import { isValidOcctResult } from "./validateOcctResult";

function parseStepInWorker(buffer: ArrayBuffer, signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const workerUrl = new URL("/vendor/occt-import-js/occt-import-js-worker.js", window.location.origin);
    const worker = new Worker(workerUrl);
    const timeout = window.setTimeout(() => { worker.terminate(); reject(new Error("timeout")); }, 60_000);
    const finish = () => { window.clearTimeout(timeout); signal.removeEventListener("abort", abort); worker.terminate(); };
    const abort = () => { finish(); reject(new DOMException("Aborted", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event: MessageEvent<unknown>) => { finish(); resolve(event.data); };
    worker.onerror = () => { finish(); reject(new Error("worker")); };
    const bytes = new Uint8Array(buffer);
    worker.postMessage({
      format: "step",
      buffer: bytes,
      params: {
        linearUnit: "millimeter",
        linearDeflectionType: "bounding_box_ratio",
        linearDeflection: 0.001,
        angularDeflection: 0.5,
      },
    }, [buffer]);
  });
}

export function StepFileViewer({ url, onRetry }: { url: string; onRetry: () => Promise<void> }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const controller = new AbortController();
    let disposed = false;
    let renderer: WebGLRenderer | null = null;
    let scene: Scene | null = null;
    let camera: PerspectiveCamera | null = null;
    let controls: { dispose(): void } | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resourcesDisposed = false;

    const disposeResources = () => {
      if (resourcesDisposed) return;
      resourcesDisposed = true;
      fitRef.current = null;
      resizeObserver?.disconnect();
      controls?.dispose();
      scene?.traverse((object) => {
        if (!("geometry" in object)) return;
        const renderable = object as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
        renderable.geometry?.dispose();
        if (Array.isArray(renderable.material)) renderable.material.forEach((material) => material.dispose());
        else renderable.material?.dispose();
      });
      renderer?.dispose();
      renderer?.domElement.remove();
    };

    setLoading(true);
    setFailed(false);
    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer" });
        if (!response.ok) throw new Error("download");
        const declaredSize = Number(response.headers.get("content-length"));
        if (Number.isFinite(declaredSize) && declaredSize > MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES) throw new Error("size");
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > MAX_INTERACTIVE_PROJECT_PREVIEW_BYTES) throw new Error("size");
        const [imported, THREE, { OrbitControls }] = await Promise.all([
          parseStepInWorker(buffer, controller.signal),
          import("three"),
          import("three/examples/jsm/controls/OrbitControls.js"),
        ]);
        if (!isValidOcctResult(imported)) throw new Error("geometry");
        if (disposed) return;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf8fafc);
        camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100000);
        camera.up.set(0, 0, 1);
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.classList.add("block", "h-full", "w-full");
        container.appendChild(renderer.domElement);
        const model = new THREE.Group();
        scene.add(model);

        for (const importedMesh of imported.meshes) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.Float32BufferAttribute(importedMesh.attributes.position.array, 3));
          if (importedMesh.attributes.normal) geometry.setAttribute("normal", new THREE.Float32BufferAttribute(importedMesh.attributes.normal.array, 3));
          else geometry.computeVertexNormals();
          geometry.setIndex(importedMesh.index.array);
          const color = importedMesh.color?.every(Number.isFinite) ? new THREE.Color(...importedMesh.color) : new THREE.Color(0xc8b58a);
          const material = new THREE.MeshStandardMaterial({ color, metalness: 0.08, roughness: 0.72, side: THREE.DoubleSide });
          const mesh = new THREE.Mesh(geometry, material);
          mesh.name = importedMesh.name ?? "";
          model.add(mesh);
          model.add(new THREE.LineSegments(
            new THREE.EdgesGeometry(geometry, 35),
            new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.55 }),
          ));
        }
        scene.add(new THREE.HemisphereLight(0xffffff, 0x64748b, 2.2));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
        keyLight.position.set(4, -5, 8);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 1.1);
        fillLight.position.set(-5, 3, 2);
        scene.add(fillLight);
        const orbitControls = new OrbitControls(camera, renderer.domElement);
        controls = orbitControls;

        const render = () => { if (renderer && scene && camera) renderer.render(scene, camera); };
        const resize = () => {
          if (!renderer || !camera) return;
          const width = Math.max(container.clientWidth, 1);
          const height = Math.max(container.clientHeight, 1);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          if (fitRef.current) fitRef.current(); else render();
        };
        const fitModel = () => {
          if (!camera) return;
          const bounds = new THREE.Box3().setFromObject(model);
          if (bounds.isEmpty()) throw new Error("geometry");
          const center = bounds.getCenter(new THREE.Vector3());
          const sphere = bounds.getBoundingSphere(new THREE.Sphere());
          const verticalFov = THREE.MathUtils.degToRad(camera.fov);
          const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
          const limitingFov = Math.min(verticalFov, horizontalFov);
          const distance = Math.max(sphere.radius, 0.5) / Math.sin(limitingFov / 2) * 1.15;
          camera.position.copy(center).add(new THREE.Vector3(1, -1, 0.8).normalize().multiplyScalar(distance));
          camera.near = Math.max(distance / 1000, 0.01);
          camera.far = Math.max(distance * 100, 1000);
          camera.updateProjectionMatrix();
          orbitControls.target.copy(center);
          orbitControls.update();
          render();
        };
        fitRef.current = fitModel;
        orbitControls.addEventListener("change", render);
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(container);
        resize();
        setLoading(false);
      } catch {
        disposeResources();
        if (!controller.signal.aborted && !disposed) { setLoading(false); setFailed(true); }
      }
    })();

    return () => { controller.abort(); disposed = true; disposeResources(); };
  }, [url]);

  if (failed) return <PreviewFailure message={PROJECT_PREVIEW_COPY.stepError} onRetry={onRetry} />;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={() => fitRef.current?.()}>
          <ScanSearch className="mr-1.5 h-4 w-4" /> {PROJECT_PREVIEW_COPY.fitModel}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">{PROJECT_PREVIEW_COPY.visualReference}</span>
      </div>
      <div className="relative h-[70vh] min-w-0 overflow-hidden rounded border bg-slate-50">
        <div ref={containerRef} className="h-full min-w-0 w-full overflow-hidden" aria-label={PROJECT_PREVIEW_COPY.stepAria} />
        {loading ? <div className="absolute inset-0"><PreviewLoading label={PROJECT_PREVIEW_COPY.stepTriangulating} /></div> : null}
      </div>
    </div>
  );
}
