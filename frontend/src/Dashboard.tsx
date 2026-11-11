
import { useEffect, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./App.css";

type Item = {
  id: number;
  name: string;
  width: number;
  height: number;
  depth: number;
  quantity: number;
  color: string;
};

type Room = {
  width: number;
  height: number;
  depth: number;
};

type Workspace = {
  roomName: string;
  room: Room;
  items: Item[];
};

const colors = ["#2563eb", "#7c3aed", "#0891b2", "#ea580c", "#db2777"];

const defaultRoom: Room = {
  width: 300,
  height: 240,
  depth: 300,
};

const defaultRoomName = "My Storage Room";


type Placement = {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
};

type PackingResult = {
  placed: Placement[];
  unplaced: string[];
};

function packItems(room: Room, items: Item[]): PackingResult {
  const placed: Placement[] = [];
  const unplaced: string[] = [];
  const epsilon = 1e-7;

  const instances = items.flatMap((item) =>
    Array.from({ length: item.quantity }, (_, index) => ({
      ...item,
      instanceId: `${item.id}-${index + 1}`,
    }))
  );

  // Place larger-volume items first, which often leaves fewer awkward gaps.
  instances.sort(
    (a, b) =>
      b.width * b.height * b.depth - a.width * a.height * a.depth
  );

  for (const item of instances) {
    const orientations = [
      [item.width, item.height, item.depth],
      [item.width, item.depth, item.height],
      [item.height, item.width, item.depth],
      [item.height, item.depth, item.width],
      [item.depth, item.width, item.height],
      [item.depth, item.height, item.width],
    ].filter(
      (dimensions, index, all) =>
        all.findIndex((other) =>
          other.every((value, i) => Math.abs(value - dimensions[i]) < epsilon)
        ) === index
    );

    // Candidate corners are the room origin and the faces of already placed items.
    const candidates = new Map<string, { x: number; y: number; z: number }>();
    const addCandidate = (x: number, y: number, z: number) => {
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
      candidates.set(key, { x, y, z });
    };

    addCandidate(0, 0, 0);
    for (const p of placed) {
      addCandidate(p.x + p.width, p.y, p.z);
      addCandidate(p.x, p.y + p.height, p.z);
      addCandidate(p.x, p.y, p.z + p.depth);
      addCandidate(p.x + p.width, p.y + p.height, p.z);
      addCandidate(p.x + p.width, p.y, p.z + p.depth);
      addCandidate(p.x, p.y + p.height, p.z + p.depth);
    }

    const sortedCandidates = [...candidates.values()].sort(
      (a, b) => a.z - b.z || a.y - b.y || a.x - b.x
    );

    let found: Placement | undefined;

    for (const position of sortedCandidates) {
      for (const [w, h, d] of orientations) {
        if (
          position.x + w > room.width + epsilon ||
          position.y + h > room.height + epsilon ||
          position.z + d > room.depth + epsilon
        ) {
          continue;
        }

        const overlaps = placed.some(
          (p) =>
            position.x < p.x + p.width - epsilon &&
            position.x + w > p.x + epsilon &&
            position.y < p.y + p.height - epsilon &&
            position.y + h > p.y + epsilon &&
            position.z < p.z + p.depth - epsilon &&
            position.z + d > p.z + epsilon
        );

        if (!overlaps) {
          found = {
            id: item.instanceId,
            name: item.name,
            color: item.color,
            x: position.x,
            y: position.y,
            z: position.z,
            width: w,
            height: h,
            depth: d,
          };
          break;
        }
      }
      if (found) break;
    }

    if (found) placed.push(found);
    else unplaced.push(`${item.name} (${item.instanceId})`);
  }

  return { placed, unplaced };
}

export default function Dashboard() {
  const [roomName, setRoomName] = useState(defaultRoomName);
  const [room, setRoom] = useState<Room>({ ...defaultRoom });
  const [items, setItems] = useState<Item[]>([]);

  const [name, setName] = useState("");
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(30);
  const [depth, setDepth] = useState(30);
  const [quantity, setQuantity] = useState(1);

  const [message, setMessage] = useState("");
  const [optimized, setOptimized] = useState(false);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [unplacedItems, setUnplacedItems] = useState<string[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [savingWorkspace, setSavingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");

  const user = auth.currentUser;
  const uid = user?.uid;

  // Load this user's workspace from Firestore.
  useEffect(() => {
    let active = true;

    async function loadWorkspace() {
      if (!uid) {
        setWorkspaceError("Please sign in to access your workspace.");
        setLoadingWorkspace(false);
        return;
      }

      setLoadingWorkspace(true);
      setWorkspaceError("");

      try {
        const workspaceRef = doc(db, "users", uid, "workspace", "current");
        const snapshot = await getDoc(workspaceRef);

        if (!active) return;

        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<Workspace>;

          if (data.roomName && typeof data.roomName === "string") {
            setRoomName(data.roomName);
          }

          if (
            data.room &&
            Number.isFinite(data.room.width) &&
            Number.isFinite(data.room.height) &&
            Number.isFinite(data.room.depth)
          ) {
            setRoom(data.room);
          }

          if (Array.isArray(data.items)) {
            setItems(
              data.items.filter(
                (item): item is Item =>
                  item !== null &&
                  typeof item === "object" &&
                  typeof item.id === "number" &&
                  typeof item.name === "string" &&
                  Number.isFinite(item.width) &&
                  Number.isFinite(item.height) &&
                  Number.isFinite(item.depth) &&
                  Number.isInteger(item.quantity) &&
                  item.quantity > 0 &&
                  typeof item.color === "string"
              )
            );
          }
        } else {
          // New account: start with an empty inventory, not demo items.
          setRoomName(defaultRoomName);
          setRoom({ ...defaultRoom });
          setItems([]);
        }
      } catch (error) {
        console.error("Unable to load workspace:", error);
        if (active) {
          setWorkspaceError(
            "Could not load your workspace. Check your connection and Firestore rules."
          );
        }
      } finally {
        if (active) setLoadingWorkspace(false);
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, [uid]);

  // Save changes only after the initial load has completed.
  useEffect(() => {
    if (!uid || loadingWorkspace || workspaceError) return;

    let cancelled = false;

    const timer = window.setTimeout(async () => {
      setSavingWorkspace(true);

      try {
        const workspaceRef = doc(db, "users", uid, "workspace", "current");

        await setDoc(
          workspaceRef,
          {
            roomName,
            room,
            items,
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        if (!cancelled) setWorkspaceError("");
      } catch (error) {
        console.error("Unable to save workspace:", error);

        if (!cancelled) {
          setWorkspaceError(
            "Your changes could not be saved. Check your Firestore rules and connection."
          );
        }
      } finally {
        if (!cancelled) setSavingWorkspace(false);
      }
    }, 700);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [uid, loadingWorkspace, workspaceError, roomName, room, items]);

  const roomVolume = room.width * room.height * room.depth;

  const itemVolume = items.reduce(
    (sum, item) =>
      sum + item.width * item.height * item.depth * item.quantity,
    0
  );

  const utilization =
    roomVolume > 0 ? (itemVolume / roomVolume) * 100 : 0;

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  function addItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setMessage("Please enter an item name.");
      return;
    }

    if (
      ![width, height, depth].every(
        (value) => Number.isFinite(value) && value > 0
      )
    ) {
      setMessage("Enter valid positive item dimensions.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setMessage("Quantity must be a positive whole number.");
      return;
    }

    setItems((current) => [
      ...current,
      {
        id: Date.now(),
        name: name.trim(),
        width,
        height,
        depth,
        quantity,
        color: colors[current.length % colors.length],
      },
    ]);

    setName("");
    setMessage("Item added. Saving your workspace…");
    setOptimized(false);
  }

  function optimizeSpace() {
    if (!roomName.trim()) {
      setMessage("Please enter a room name.");
      setOptimized(false);
      return;
    }

    if (![room.width, room.height, room.depth].every(
      (value) => Number.isFinite(value) && value > 0
    )) {
      setMessage("Enter valid positive room dimensions.");
      setOptimized(false);
      return;
    }

    if (items.length === 0) {
      setMessage("Add at least one item first.");
      setOptimized(false);
      return;
    }

    if (!items.every((item) =>
      [item.width, item.height, item.depth].every(
        (value) => Number.isFinite(value) && value > 0
      ) && Number.isInteger(item.quantity) && item.quantity > 0
    )) {
      setMessage("Every item must have positive dimensions and a valid quantity.");
      setOptimized(false);
      return;
    }

    const result = packItems(room, items);
    setPlacements(result.placed);
    setUnplacedItems(result.unplaced);
    setOptimized(result.unplaced.length === 0);

    if (result.unplaced.length === 0) {
      setMessage(
        `Placement successful: all ${result.placed.length} item(s) fit without overlaps.`
      );
    } else {
      setMessage(
        `Placed ${result.placed.length} of ${result.placed.length + result.unplaced.length} item(s). ${result.unplaced.length} could not be placed. Try changing dimensions or item order.`
      );
    }
  }

  function resetProject() {
    setRoomName(defaultRoomName);
    setRoom({ ...defaultRoom });
    setItems([]);
    setName("");
    setWidth(30);
    setHeight(30);
    setDepth(30);
    setQuantity(1);
    setOptimized(false);
    setPlacements([]);
    setUnplacedItems([]);
    setMessage("Workspace reset. Saving your changes…");
  }

  if (loadingWorkspace) {
    return (
      <div className="auth-loading">
        <div className="auth-logo">S3</div>
        <p>Loading your personal workspace…</p>
      </div>
    );
  }

  if (!uid) {
    return <div className="content">Please sign in to continue.</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">S3</div>
          <div>
            <strong>SmartSpace <span>3D</span></strong>
            <small>SPACE OPTIMIZATION</small>
          </div>
        </div>

        <p className="nav-label">WORKSPACE</p>
        <div className="nav-link active">▦ &nbsp; Space Planner</div>
        <div className="nav-link">▤ &nbsp; Item Inventory</div>
        <div className="nav-link">◷ &nbsp; Saved Plans</div>

        <div className="sidebar-note">
          <span>✦</span>
          <strong>Make room for more.</strong>
          <p>Plan your space before moving a single box.</p>
        </div>

        <div className="sidebar-footer">Personal workspace · v0.3</div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <span>
            Workspace / <strong>Space Planner</strong>
          </span>
          <span className="status-pill">
            ● {savingWorkspace ? "Saving…" : "Cloud workspace"}
          </span>
        </header>

        <div className="content">
          <section className="page-heading">
            <div>
              <span className="eyebrow">YOUR SPACE, REIMAGINED</span>
              <h1>Space Planner</h1>
              <p>
                Configure your room, add items, and explore a smarter
                storage layout.
              </p>
              <p>
                Signed in as <strong>{user?.email || "your account"}</strong>
              </p>
            </div>

            <button className="secondary-button" onClick={resetProject}>
              Reset project
            </button>
          </section>

          {workspaceError && (
            <div className="message" role="alert">
              {workspaceError}
            </div>
          )}

          <section className="stats-grid">
            <div className="stat-card">
              <span className="stat-icon blue">▱</span>
              <div>
                <small>ROOM VOLUME</small>
                <h2>{roomVolume.toLocaleString()} <em>cm³</em></h2>
                <p>Based on room dimensions</p>
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-icon purple">▦</span>
              <div>
                <small>TOTAL ITEMS</small>
                <h2>{totalItems}</h2>
                <p>{items.length} different item types</p>
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-icon cyan">◩</span>
              <div>
                <small>VOLUME ESTIMATE</small>
                <h2>{utilization.toFixed(1)}<em>%</em></h2>
                <p>Volume, not physical fit</p>
              </div>
            </div>
          </section>

          <div className="workspace-grid">
            <section className="panel">
              <div className="section-heading">
                <div>
                  <small>STEP 01</small>
                  <h2>Room dimensions</h2>
                  <p>Enter your internal room measurements.</p>
                </div>
                <span className="heading-icon">⌗</span>
              </div>

              <label className="form-label">
                Room name
                <input
                  value={roomName}
                  maxLength={60}
                  onChange={(event) => {
                    setRoomName(event.target.value);
                    setOptimized(false);
                  }}
                  placeholder="e.g. Bedroom Storage"
                />
              </label>

              <div className="dimension-grid">
                {(["width", "height", "depth"] as const).map((key) => (
                  <label key={key}>
                    {key[0].toUpperCase() + key.slice(1)} <span>cm</span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={room[key] || ""}
                      onChange={(event) => {
                        const raw = event.target.value;
                        setRoom((current) => ({
                          ...current,
                          [key]: raw === "" ? 0 : Number(raw),
                        }));
                        setOptimized(false);
                      }}
                    />
                  </label>
                ))}
              </div>

              <p className="info-note">
                ⓘ Use usable interior dimensions and account for obstacles.
              </p>
            </section>

            <section className="panel">
              <div className="section-heading">
                <div>
                  <small>STEP 02</small>
                  <h2>Add storage items</h2>
                  <p>Describe the items you need to store.</p>
                </div>
                <span className="heading-icon">＋</span>
              </div>

              <form onSubmit={addItem}>
                <label className="form-label">
                  Item name
                  <input
                    value={name}
                    maxLength={60}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Suitcase, carton, books"
                    required
                  />
                </label>

                <div className="item-form-grid">
                  <label>
                    Width (cm)
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={width || ""}
                      onChange={(event) =>
                        setWidth(event.target.value === "" ? 0 : Number(event.target.value))
                      }
                      required
                    />
                  </label>

                  <label>
                    Height (cm)
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={height || ""}
                      onChange={(event) =>
                        setHeight(event.target.value === "" ? 0 : Number(event.target.value))
                      }
                      required
                    />
                  </label>

                  <label>
                    Depth (cm)
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={depth || ""}
                      onChange={(event) =>
                        setDepth(event.target.value === "" ? 0 : Number(event.target.value))
                      }
                      required
                    />
                  </label>

                  <label>
                    Quantity
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={quantity || ""}
                      onChange={(event) =>
                        setQuantity(event.target.value === "" ? 0 : Number(event.target.value))
                      }
                      required
                    />
                  </label>
                </div>

                <button className="primary-button" type="submit">
                  ＋ Add item
                </button>
              </form>
            </section>

            <section className="panel inventory-panel">
              <div className="section-heading">
                <div>
                  <small>YOUR INVENTORY</small>
                  <h2>
                    Items to place <span className="count-badge">{totalItems}</span>
                  </h2>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="empty-state">
                  <span>▤</span>
                  <strong>No items added yet</strong>
                  <p>Add your first item using the form above.</p>
                </div>
              ) : (
                <div className="inventory-list">
                  {items.map((item) => (
                    <div className="inventory-row" key={item.id}>
                      <div className="item-color" style={{ background: item.color }}>
                        ▦
                      </div>
                      <div className="item-info">
                        <strong>{item.name}</strong>
                        <small>
                          {item.width} × {item.height} × {item.depth} cm
                        </small>
                      </div>
                      <strong className="quantity">× {item.quantity}</strong>
                      <button
                        className="remove-button"
                        type="button"
                        title={`Remove ${item.name}`}
                        aria-label={`Remove ${item.name}`}
                        onClick={() => {
                          setItems((current) =>
                            current.filter((entry) => entry.id !== item.id)
                          );
                          setOptimized(false);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="panel preview-panel">
              <div className="section-heading">
                <div>
                  <small>STEP 03</small>
                  <h2>3D space preview</h2>
                  <p>Illustrative view of your room and items.</p>
                </div>
                <span className="live-badge">LIVE PREVIEW</span>
              </div>

              <div className="scene">
                <div className="scene-grid"></div>
                <div className="room">
                  <div className="room-back"></div>
                  <div className="room-side"></div>
                  <div className="room-floor"></div>

                  {optimized &&
                    placements.map((box) => {
                      // Project the calculated 3D coordinates onto the room illustration.
                      const left = 12 + (box.x / room.width) * 48 + (box.z / room.depth) * 22;
                      const bottom = 12 + (box.y / room.height) * 58 + (box.z / room.depth) * 18;
                      const boxWidth = Math.max(2.5, (box.width / room.width) * 48);
                      const boxHeight = Math.max(2.5, (box.height / room.height) * 48);
                      return (
                        <div
                          key={box.id}
                          title={`${box.name}: x=${box.x}, y=${box.y}, z=${box.z} cm | ${box.width} × ${box.height} × ${box.depth} cm`}
                          className="visual-box"
                          style={{
                            background: box.color,
                            left: `${Math.min(88, left)}%`,
                            bottom: `${Math.min(82, bottom)}%`,
                            width: `${Math.min(20, boxWidth)}%`,
                            height: `${Math.min(20, boxHeight)}%`,
                          }}
                        />
                      );
                    })}

                  <span className="room-label width-label">{room.width} cm</span>
                  <span className="room-label height-label">{room.height} cm</span>
                  <span className="room-label depth-label">{room.depth} cm</span>
                </div>

                <div className="scene-legend">
                  <span><i className="room-key"></i> Room boundary</span>
                  <span><i className="item-key"></i> Stored items</span>
                </div>
              </div>

              <div className="preview-actions">
                <div>
                  <strong>{optimized ? "Checks completed" : "Ready to plan?"}</strong>
                  <p>
                    {optimized
                      ? "All items placed with boundary and overlap checks passed."
                      : "Run the packing algorithm to calculate item positions."}
                  </p>
                </div>
                <button className="optimize-button" onClick={optimizeSpace}>
                  ✦ Check space →
                </button>
              </div>

              {message && (
                <div className={`message ${optimized ? "success-message" : ""}`} role="status">
                  {message}
                </div>
              )}
              {unplacedItems.length > 0 && (
                <div className="message" role="alert">
                  <strong>Items not placed:</strong>
                  <ul>
                    {unplacedItems.map((itemId) => <li key={itemId}>{itemId}</li>)}
                  </ul>
                </div>
              )}
              {optimized && placements.length > 0 && (
                <div className="info-note">
                  <strong>Calculated positions (cm)</strong>
                  <ul>
                    {placements.map((p) => (
                      <li key={p.id}>
                        {p.name}: x={p.x}, y={p.y}, z={p.z} · {p.width} × {p.height} × {p.depth}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="disclaimer">
                The placement algorithm checks room boundaries and item overlaps. The preview is a simplified 2D projection of the calculated 3D coordinates, not a fully interactive 3D renderer.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}