import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { BoxGeometry, Matrix4, Quaternion, Vector3 } from 'three'
import type { InstancedMesh } from 'three'
import type { PackRoom, Placement, RackLayout } from '../../utils/packing'

// 1 unit in the 3D scene = 1 metre, so cm values are divided by 100.
const SCALE = 0.01

interface SceneProps {
  room: PackRoom
  placements: Placement[]
  colorOf: (placement: Placement) => string
  onHover: (placement: Placement | null) => void
  rackLayout?: RackLayout
}

// Shelf boards and posts of the racks (drawn thin, so the cartons stay visible).
function Racks({ layout, room }: { layout: RackLayout; room: PackRoom }) {
  const L = room.lengthCm * SCALE
  const W = room.widthCm * SCALE
  const D = layout.depthCm * SCALE
  const posts = Math.max(2, Math.ceil(room.lengthCm / 250) + 1)
  const topM = layout.levelHeightCm * layout.levels * SCALE
  return (
    <group>
      {layout.stripY0.map((y0) => {
        const zCenter = (y0 + layout.depthCm / 2) * SCALE - W / 2
        return (
          <group key={y0}>
            {Array.from({ length: layout.levels }, (_, level) => (
              <mesh key={level} position={[0, level * layout.levelHeightCm * SCALE + (layout.beamCm * SCALE) / 2, zCenter]}>
                <boxGeometry args={[L, layout.beamCm * SCALE, D]} />
                <meshStandardMaterial color="#cbd5e1" />
              </mesh>
            ))}
            {Array.from({ length: posts }, (_, i) => {
              const x = -L / 2 + (L * i) / (posts - 1)
              return [-D / 2, D / 2].map((dz) => (
                <mesh key={`${i}-${dz}`} position={[x, topM / 2, zCenter + dz]}>
                  <boxGeometry args={[0.04, topM, 0.04]} />
                  <meshStandardMaterial color="#94a3b8" />
                </mesh>
              ))
            })}
          </group>
        )
      })}
    </group>
  )
}

// All cartons of one colour are drawn as ONE instanced mesh, which keeps thousands of boxes fast.
function CartonGroup({
  color,
  items,
  room,
  onHover,
}: {
  color: string
  items: Placement[]
  room: PackRoom
  onHover: (placement: Placement | null) => void
}) {
  const ref = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const matrix = new Matrix4()
    const position = new Vector3()
    const size = new Vector3()
    const turn = new Quaternion()
    items.forEach((p, index) => {
      // room (x, y, z) -> scene (X, Z, Y): the scene's up axis is Y
      position.set(
        (p.x + p.dx / 2) * SCALE - (room.lengthCm * SCALE) / 2,
        (p.z + p.dz / 2) * SCALE,
        (p.y + p.dy / 2) * SCALE - (room.widthCm * SCALE) / 2,
      )
      size.set(p.dx * SCALE * 0.97, p.dz * SCALE * 0.97, p.dy * SCALE * 0.97) // 3% gap shows each carton
      matrix.compose(position, turn, size)
      mesh.setMatrixAt(index, matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [items, room])

  function handleMove(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation()
    onHover(event.instanceId === undefined ? null : (items[event.instanceId] ?? null))
  }

  return (
    <instancedMesh
      key={items.length}
      ref={ref}
      args={[undefined, undefined, items.length]}
      onPointerMove={handleMove}
      onPointerOut={() => onHover(null)}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} roughness={0.55} />
    </instancedMesh>
  )
}

export function PackingScene({ room, placements, colorOf, onHover, rackLayout }: SceneProps) {
  const lengthM = room.lengthCm * SCALE
  const widthM = room.widthCm * SCALE
  const heightM = room.heightCm * SCALE

  const groups = useMemo(() => {
    const map = new Map<string, Placement[]>()
    for (const p of placements) {
      const color = colorOf(p)
      const list = map.get(color)
      if (list) list.push(p)
      else map.set(color, [p])
    }
    return [...map.entries()]
  }, [placements, colorOf])

  const roomBox = useMemo(() => new BoxGeometry(lengthM, heightM, widthM), [lengthM, heightM, widthM])
  const reach = Math.max(lengthM, widthM, heightM)

  return (
    <Canvas camera={{ position: [reach * 0.9, reach * 0.9, reach * 1.3], fov: 45 }} dpr={[1, 2]}>
      <color attach="background" args={['#f5f7fb']} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[lengthM, heightM * 3, widthM]} intensity={1.4} />

      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <planeGeometry args={[lengthM, widthM]} />
        <meshStandardMaterial color="#ecfdf5" />
      </mesh>

      {/* room outline */}
      <lineSegments position={[0, heightM / 2, 0]}>
        <edgesGeometry args={[roomBox]} />
        <lineBasicMaterial color="#64748b" />
      </lineSegments>

      {/* door marker on the y = 0 wall */}
      <mesh position={[0, 0.01, -widthM / 2]}>
        <boxGeometry args={[lengthM, 0.02, 0.12]} />
        <meshStandardMaterial color="#10b981" />
      </mesh>
      <Html position={[0, 0.1, -widthM / 2 - 0.35]} center>
        <span className="scene-label">Door side (earliest expiry here)</span>
      </Html>

      {rackLayout && <Racks layout={rackLayout} room={room} />}

      {groups.map(([color, items]) => (
        <CartonGroup key={color} color={color} items={items} room={room} onHover={onHover} />
      ))}

      <OrbitControls makeDefault target={[0, heightM / 3, 0]} maxPolarAngle={Math.PI / 2.02} />
    </Canvas>
  )
}
