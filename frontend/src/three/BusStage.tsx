import { Component, useEffect, useMemo, useRef, type ElementRef, type ReactNode } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { buildBus, disposeRig, paintHealth, setShellOpacity, updateFlow, updateMods, type PackId } from './bus'
import { CAMS, type ViewState } from './viewState'

export type BusSpec = { key: string; label: string; healthPct: number; offsetZ: number; packLabels?: boolean }
type Props = { buses: BusSpec[]; lengthM: 12 | 9; linePct: number; view: ViewState; hovered: PackId | null; onHover: (id: PackId | null) => void; onSelect: (id: PackId | null) => void; ariaLabel: string }

const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion:reduce)').matches
const PACK_NAMES: Record<PackId, string> = { roof: 'Roof packs', under: 'Underfloor packs', rear: 'Rear pack' }

function Bus({ spec, lengthM, linePct, view, hovered, onHover, onSelect }: { spec: BusSpec } & Pick<Props, 'lengthM' | 'linePct' | 'view' | 'hovered' | 'onHover' | 'onSelect'>) {
  const rig = useMemo(() => buildBus(lengthM), [lengthM])
  const gl = useThree((s) => s.gl)
  useEffect(() => () => disposeRig(rig), [rig])
  useEffect(() => { paintHealth(rig, spec.healthPct, linePct) }, [rig, spec.healthPct, linePct])
  useEffect(() => { setShellOpacity(rig, view.shell) }, [rig, view.shell])
  useEffect(() => {
    rig.shellG.visible = view.layers.shell; rig.chassisG.visible = view.layers.chassis; rig.packG.visible = view.layers.packs
    rig.dim.visible = view.layers.dims; rig.flow.visible = view.layers.flow
  }, [rig, view.layers])

  useFrame(({ clock }) => {
    const t = reducedMotion() ? 0 : clock.elapsedTime
    if (view.layers.flow) updateFlow(rig, t)
    const scanX = view.layers.scan && !reducedMotion() ? -7 + ((t * 3) % 16) : null
    updateMods(rig, { explode: view.explode, selected: view.selected, hovered, isolate: view.isolate, scanX, scanOffsetX: 0 })
  })

  const idOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => (e.object.userData.id as PackId | undefined) ?? null
  return (
    <group position={[0, 0, spec.offsetZ]}>
      <primitive
        object={rig.group}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); const id = idOf(e); if (id) { onHover(id); gl.domElement.style.cursor = 'pointer' } }}
        onPointerOut={() => { onHover(null); gl.domElement.style.cursor = '' }}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); const id = idOf(e); if (id) onSelect(view.selected === id ? null : id) }}
      />
      {view.layers.labels && (
        <>
          <Html position={[-6.2 * rig.k, 3.9, 0]} center className="lbl3d bus" zIndexRange={[5, 0]}>{spec.label} · {Math.round(spec.healthPct)}%</Html>
          {view.layers.packs && spec.packLabels !== false && (['roof', 'under', 'rear'] as PackId[]).map((id) => {
            const m = rig.mods[id][0]
            return <Html key={id} position={[m.userData.base.x * (id === 'roof' ? 0 : 1) + (id === 'rear' ? 0.3 : 0), m.userData.base.y + (id === 'roof' ? 0.9 : id === 'under' ? -0.55 : 1.0), id === 'under' ? 1.4 : 0]} center className={`lbl3d${view.selected === id ? ' on' : ''}`} zIndexRange={[4, 0]}>{PACK_NAMES[id]}</Html>
          })}
        </>
      )}
      {view.layers.dims && <Html position={[0, -0.05, 2.1]} center className="lbl3d" zIndexRange={[4, 0]}>{lengthM} m</Html>}
    </group>
  )
}

function CameraRig({ cam, nonce }: { cam: ViewState['cam']; nonce: number }) {
  const controls = useRef<ElementRef<typeof OrbitControls>>(null)
  const camera = useThree((s) => s.camera)
  // Canvas keeps a fixed vertical field of view, so on a narrow screen the sides get cropped: back the camera off to compensate.
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null)
  useEffect(() => {
    const c = CAMS[cam]
    const target = new THREE.Vector3(...c.target), k = Math.max(1, 1.4 / aspect)
    goal.current = { pos: new THREE.Vector3(...c.pos).sub(target).multiplyScalar(k).add(target), target }
    if (reducedMotion() && controls.current) { camera.position.copy(goal.current.pos); controls.current.target.copy(goal.current.target); controls.current.update(); goal.current = null }
  }, [cam, nonce, camera, aspect])
  useFrame((_, dt) => {
    const g = goal.current, ct = controls.current
    if (!g || !ct) return
    const k = 1 - Math.exp(-dt * 5)
    camera.position.lerp(g.pos, k); ct.target.lerp(g.target, k); ct.update()
    if (camera.position.distanceTo(g.pos) < 0.03) goal.current = null
  })
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={4} maxDistance={32} maxPolarAngle={Math.PI * 0.52} onStart={() => { goal.current = null }} />
}

/** If WebGL fails after the canvas starts (lost context, driver bug), show the fallback instead of a blank page. */
export class StageBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

export default function BusStage({ buses, lengthM, linePct, view, hovered, onHover, onSelect, ariaLabel }: Props) {
  const c = CAMS[view.cam]
  return (
    <Canvas flat dpr={[1, 2]} camera={{ position: c.pos, fov: 36, near: 0.1, far: 120 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} onPointerMissed={() => onSelect(null)} role="img" aria-label={ariaLabel}>
      <ambientLight intensity={0.7} />
      <directionalLight position={[6, 10, 8]} intensity={1.6} />
      <pointLight position={[-8, 4, -6]} intensity={30} color="#FACC15" distance={30} />
      <gridHelper args={[48, 48, 0x3f3f46, 0x1f1f23]} position={[0, -0.02, 0]} />
      {buses.map((b) => <Bus key={b.key} spec={b} lengthM={lengthM} linePct={linePct} view={view} hovered={hovered} onHover={onHover} onSelect={onSelect} />)}
      <CameraRig cam={view.cam} nonce={view.camNonce} />
    </Canvas>
  )
}
