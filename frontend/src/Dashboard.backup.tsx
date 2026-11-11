
import { useState } from "react";
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

const colors = ["#2563eb", "#7c3aed", "#0891b2", "#ea580c", "#db2777"];

const DEFAULT_ROOM = {
  width: 300,
  height: 240,
  depth: 300,
};

const DEFAULT_ROOM_NAME = "My Storage Room";

export default function App() {
  const [roomName, setRoomName] = useState(DEFAULT_ROOM_NAME);
  const [room, setRoom] = useState({ ...DEFAULT_ROOM });

  const [items, setItems] = useState<Item[]>([
    {
      id: 1,
      name: "Storage Box",
      width: 40,
      height: 30,
      depth: 30,
      quantity: 3,
      color: colors[0],
    },
    {
      id: 2,
      name: "Books",
      width: 25,
      height: 20,
      depth: 20,
      quantity: 4,
      color: colors[1],
    },
  ]);

  const [name, setName] = useState("");
  const [width, setWidth] = useState(30);
  const [height, setHeight] = useState(30);
  const [depth, setDepth] = useState(30);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [optimized, setOptimized] = useState(false);

  const roomVolume = room.width * room.height * room.depth;

  const itemVolume = items.reduce(
    (sum, item) =>
      sum + item.width * item.height * item.depth * item.quantity,
    0
  );

  const utilization =
    roomVolume > 0 ? (itemVolume / roomVolume) * 100 : 0;

  const totalItems = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const validRoom =
    roomName.trim().length > 0 &&
    [room.width, room.height, room.depth].every(
      (value) => Number.isFinite(value) && value > 0
    );

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
      setMessage("Enter valid positive dimensions for the item.");
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
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
    setMessage("Item added successfully.");
    setOptimized(false);
  }

  function optimizeSpace() {
    if (!roomName.trim()) {
      setMessage("Please enter a room name.");
      setOptimized(false);
      return;
    }

    const roomDimensions = [room.width, room.height, room.depth];

    if (
      roomDimensions.some(
        (value) => !Number.isFinite(value) || value <= 0
      )
    ) {
      setMessage("Enter valid positive room dimensions.");
      setOptimized(false);
      return;
    }

    if (items.length === 0) {
      setMessage("Add at least one item first.");
      setOptimized(false);
      return;
    }

    const invalidItem = items.some(
      (item) =>
        !item.name.trim() ||
        ![item.width, item.height, item.depth].every(
          (value) => Number.isFinite(value) && value > 0
        ) ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
    );

    if (invalidItem) {
      setMessage(
        "Check that every item has valid dimensions and quantity."
      );
      setOptimized(false);
      return;
    }

    if (itemVolume > roomVolume) {
      setMessage(
        "Total item volume exceeds room volume. These items cannot all fit."
      );
      setOptimized(false);
      return;
    }

    setOptimized(true);
    setMessage(
      "Basic checks passed. Physical item placement has not yet been verified."
    );
  }

  function resetProject() {
    setRoomName(DEFAULT_ROOM_NAME);
    setRoom({ ...DEFAULT_ROOM });
    setItems([]);
    setName("");
    setWidth(30);
    setHeight(30);
    setDepth(30);
    setQuantity(1);
    setOptimized(false);
    setMessage("Room reset. Add your own items.");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">S3</div>
          <div>
            <strong>
              SmartSpace <span>3D</span>
            </strong>
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

        <div className="sidebar-footer">
          ● Prototype workspace · v0.2
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <span>
            Workspace / <strong>Space Planner</strong>
          </span>
          <span className="status-pill">● Prototype</span>
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
            </div>

            <button className="secondary-button" onClick={resetProject}>
              Reset project
            </button>
          </section>

          <section className="stats-grid">
            <div className="stat-card">
              <span className="stat-icon blue">▱</span>
              <div>
                <small>ROOM VOLUME</small>
                <h2>
                  {roomVolume > 0
                    ? roomVolume.toLocaleString()
                    : "—"}{" "}
                  <em>cm³</em>
                </h2>
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
                <h2>
                  {roomVolume > 0 ? utilization.toFixed(1) : "—"}
                  <em>%</em>
                </h2>
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
                  <p>Enter the internal room measurements.</p>
                </div>
                <span className="heading-icon">⌗</span>
              </div>

              <label className="form-label">
                Room name
                <input
                  type="text"
                  value={roomName}
                  onChange={(event) => {
                    setRoomName(event.target.value);
                    setOptimized(false);
                    setMessage("");
                  }}
                  placeholder="e.g. Bedroom Storage"
                  maxLength={60}
                  required
                />
              </label>

              <div className="dimension-grid">
                {(["width", "height", "depth"] as const).map((key) => (
                  <label key={key}>
                    {key[0].toUpperCase() + key.slice(1)}{" "}
                    <span>cm</span>
                    <input
                      type="number"
                      min="1"
                      step="any"
                      value={room[key] === 0 ? "" : room[key]}
                      onChange={(event) => {
                        const rawValue = event.target.value;
                        const value =
                          rawValue === "" ? 0 : Number(rawValue);

                        setRoom((current) => ({
                          ...current,
                          [key]: value,
                        }));

                        setOptimized(false);
                        setMessage("");
                      }}
                    />
                  </label>
                ))}
              </div>

              <p className="info-note">
                ⓘ Use usable interior dimensions and account for any
                obstacles.
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
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Suitcase, carton, books"
                    maxLength={60}
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
                      value={width}
                      onChange={(event) =>
                        setWidth(
                          event.target.value === ""
                            ? 0
                            : Number(event.target.value)
                        )
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
                      value={height}
                      onChange={(event) =>
                        setHeight(
                          event.target.value === ""
                            ? 0
                            : Number(event.target.value)
                        )
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
                      value={depth}
                      onChange={(event) =>
                        setDepth(
                          event.target.value === ""
                            ? 0
                            : Number(event.target.value)
                        )
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
                      value={quantity}
                      onChange={(event) =>
                        setQuantity(
                          event.target.value === ""
                            ? 0
                            : Number(event.target.value)
                        )
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
                    Items to place{" "}
                    <span className="count-badge">{totalItems}</span>
                  </h2>
                </div>
              </div>

              {items.length === 0 ? (
                <div className="empty-state">
                  <span>▤</span>
                  <strong>No items added yet</strong>
                  <p>Use the form above to add your first item.</p>
                </div>
              ) : (
                <div className="inventory-list">
                  {items.map((item) => (
                    <div className="inventory-row" key={item.id}>
                      <div
                        className="item-color"
                        style={{ background: item.color }}
                      >
                        ▦
                      </div>

                      <div className="item-info">
                        <strong>{item.name}</strong>
                        <small>
                          {item.width} × {item.height} × {item.depth} cm
                        </small>
                      </div>

                      <strong className="quantity">
                        × {item.quantity}
                      </strong>

                      <button
                        className="remove-button"
                        type="button"
                        title={`Remove ${item.name}`}
                        aria-label={`Remove ${item.name}`}
                        onClick={() => {
                          setItems((current) =>
                            current.filter((x) => x.id !== item.id)
                          );
                          setOptimized(false);
                          setMessage("");
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

                  {items
                    .flatMap((item) =>
                      Array.from(
                        { length: Math.min(item.quantity, 4) },
                        (_, index) => ({
                          id: `${item.id}-${index}`,
                          name: item.name,
                          color: item.color,
                        })
                      )
                    )
                    .slice(0, 16)
                    .map((box, index) => (
                      <div
                        key={box.id}
                        title={box.name}
                        className="visual-box"
                        style={{
                          background: box.color,
                          left: `${25 + (index % 4) * 13}%`,
                          bottom: `${
                            22 + Math.floor(index / 4) * 15
                          }%`,
                        }}
                      />
                    ))}

                  <span className="room-label width-label">
                    {room.width > 0 ? room.width : "—"} cm
                  </span>
                  <span className="room-label height-label">
                    {room.height > 0 ? room.height : "—"} cm
                  </span>
                  <span className="room-label depth-label">
                    {room.depth > 0 ? room.depth : "—"} cm
                  </span>
                </div>

                <div className="scene-legend">
                  <span>
                    <i className="room-key"></i> Room boundary
                  </span>
                  <span>
                    <i className="item-key"></i> Stored items
                  </span>
                </div>
              </div>

              <div className="preview-actions">
                <div>
                  <strong>
                    {optimized ? "Checks completed" : "Ready to plan?"}
                  </strong>
                  <p>
                    {optimized
                      ? `Basic checks passed for ${roomName.trim()}.`
                      : "Validate your room and inventory before planning."}
                  </p>
                </div>

                <button
                  className="optimize-button"
                  type="button"
                  onClick={optimizeSpace}
                >
                  ✦ Check space →
                </button>
              </div>

              {message && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`message ${
                    optimized ? "success-message" : ""
                  }`}
                >
                  {message}
                </div>
              )}

              <p className="disclaimer">
                Prototype: the preview is illustrative, not a verified
                packing solution. Physical placement and collision
                detection will be implemented in a later step.
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}