// A decorative 3D-style storage room with boxes, drawn with plain SVG.
// Coordinates are (x, y, z) in "room units"; project() turns them into screen points.

const UNIT = 38

function project(x: number, y: number, z: number): [number, number] {
  return [(x - y) * UNIT, (x + y) * UNIT * 0.5 - z * UNIT]
}

function points(list: Array<[number, number, number]>): string {
  return list.map(([x, y, z]) => project(x, y, z).join(',')).join(' ')
}

interface BoxSpec {
  x: number
  y: number
  w: number // size along x
  d: number // size along y
  h: number // height
  top: string
  left: string
  right: string
}

const ROOM = 6
const WALL_HEIGHT = 3.6

const boxes: BoxSpec[] = [
  { x: 0.3, y: 0.3, w: 2.2, d: 2, h: 1.5, top: '#A7F3D0', left: '#34D399', right: '#10B981' },
  { x: 2.8, y: 0.3, w: 1.6, d: 1.6, h: 1, top: '#E0E7F5', left: '#9AA9CC', right: '#7B8BB4' },
  { x: 0.3, y: 2.7, w: 1.6, d: 1.6, h: 2.3, top: '#4B5C8F', left: '#1C2541', right: '#0B132B' },
  { x: 2.5, y: 2.5, w: 2.2, d: 2.2, h: 1.2, top: '#6FFFB0', left: '#2DD4A0', right: '#10B981' },
  { x: 4.5, y: 0.5, w: 1.2, d: 1.2, h: 1.9, top: '#FFFFFF', left: '#D6DEEC', right: '#B6C2DA' },
  { x: 4.9, y: 3.1, w: 0.9, d: 1.4, h: 0.8, top: '#A7F3D0', left: '#34D399', right: '#10B981' },
]

export function RoomIllustration() {
  // Draw boxes from back to front so nearer boxes cover farther ones.
  const sorted = [...boxes].sort((a, b) => a.x + a.y - (b.x + b.y))

  return (
    <svg
      className="room-illustration"
      viewBox="-250 -170 500 400"
      role="img"
      aria-label="Illustration of boxes arranged inside a storage room"
    >
      {/* floor */}
      <polygon
        points={points([[0, 0, 0], [ROOM, 0, 0], [ROOM, ROOM, 0], [0, ROOM, 0]])}
        fill="#ECFDF5"
        stroke="#A7F3D0"
        strokeWidth="1.5"
      />
      {/* back walls */}
      <polygon
        points={points([[0, 0, 0], [ROOM, 0, 0], [ROOM, 0, WALL_HEIGHT], [0, 0, WALL_HEIGHT]])}
        fill="#FFFFFF"
        fillOpacity="0.85"
        stroke="#D6DEEC"
        strokeWidth="1.5"
      />
      <polygon
        points={points([[0, 0, 0], [0, ROOM, 0], [0, ROOM, WALL_HEIGHT], [0, 0, WALL_HEIGHT]])}
        fill="#F5F8FC"
        fillOpacity="0.9"
        stroke="#D6DEEC"
        strokeWidth="1.5"
      />
      {/* boxes */}
      {sorted.map((box, index) => (
        <g key={index} stroke="#0B132B" strokeOpacity="0.12" strokeWidth="1" strokeLinejoin="round">
          {/* left face (front-facing +y side) */}
          <polygon
            points={points([
              [box.x, box.y + box.d, 0],
              [box.x + box.w, box.y + box.d, 0],
              [box.x + box.w, box.y + box.d, box.h],
              [box.x, box.y + box.d, box.h],
            ])}
            fill={box.left}
          />
          {/* right face (+x side) */}
          <polygon
            points={points([
              [box.x + box.w, box.y, 0],
              [box.x + box.w, box.y + box.d, 0],
              [box.x + box.w, box.y + box.d, box.h],
              [box.x + box.w, box.y, box.h],
            ])}
            fill={box.right}
          />
          {/* top face */}
          <polygon
            points={points([
              [box.x, box.y, box.h],
              [box.x + box.w, box.y, box.h],
              [box.x + box.w, box.y + box.d, box.h],
              [box.x, box.y + box.d, box.h],
            ])}
            fill={box.top}
          />
        </g>
      ))}
    </svg>
  )
}
