/* global Java */
(function () {
  "use strict";

  const FIXED_SHIFT = 16;
  const FIXED_ONE = 1 << FIXED_SHIFT;

  const RIGID_BODY_TYPE = "com.quietterminal.clockwork.plugins.RigidBodyComponent";
  const COLLIDER_TYPE = "com.quietterminal.clockwork.plugins.ColliderComponent";
  const STRUCTURAL_TYPE = "com.quietterminal.clockwork.plugins.StructuralBodyComponent";
  const FORCE_COMMAND_TYPE = "com.quietterminal.clockwork.plugins.PhysicsForceCommand";

  let javaBindings;

  function java() {
    if (javaBindings) {
      return javaBindings;
    }

    const JFixed = Java.type("com.quietterminal.clockwork.math.Fixed");
    const JVec2 = Java.type("com.quietterminal.clockwork.math.Vec2");

    javaBindings = {
      JFixed,
      JVec2,
      JRigidBody: Java.type(RIGID_BODY_TYPE),
      JCollider: Java.type(COLLIDER_TYPE),
      JStructural: Java.type(STRUCTURAL_TYPE),
      JCollisionStartedEvent: Java.type("com.quietterminal.clockwork.plugins.CollisionStartedEvent"),
      JCollisionEndedEvent: Java.type("com.quietterminal.clockwork.plugins.CollisionEndedEvent"),
      JBodyFracturedEvent: Java.type("com.quietterminal.clockwork.plugins.BodyFracturedEvent"),
      fixedOfRaw(raw) {
        if (typeof JFixed.ofRaw === "function") {
          return JFixed.ofRaw(raw | 0);
        }
        return new JFixed(raw | 0);
      },
      vec2OfRaw(vec) {
        return new JVec2(this.fixedOfRaw(vec.x), this.fixedOfRaw(vec.y));
      }
    };

    return javaBindings;
  }

  function readMember(value, member) {
    if (value == null) {
      return null;
    }
    const slot = value[member];
    if (typeof slot === "function") {
      return slot.call(value);
    }
    return slot;
  }

  function toInt(value, fallback) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value | 0;
    }
    if (typeof value === "bigint") {
      return Number(value) | 0;
    }
    return fallback;
  }

  function parseFixedRaw(value, fallback = 0) {
    if (value == null) {
      return fallback | 0;
    }
    if (typeof value === "number") {
      return value | 0;
    }
    const raw = readMember(value, "raw");
    if (typeof raw === "number") {
      return raw | 0;
    }
    return fallback | 0;
  }

  function parseVec2Raw(value, fallbackX = 0, fallbackY = 0) {
    if (value == null) {
      return { x: fallbackX | 0, y: fallbackY | 0 };
    }
    const x = parseFixedRaw(readMember(value, "x"), fallbackX);
    const y = parseFixedRaw(readMember(value, "y"), fallbackY);
    return { x, y };
  }

  function fixedAdd(a, b) {
    return (a + b) | 0;
  }

  function fixedSub(a, b) {
    return (a - b) | 0;
  }

  function fixedMul(a, b) {
    return Number((BigInt(a | 0) * BigInt(b | 0)) >> BigInt(FIXED_SHIFT)) | 0;
  }

  function fixedDiv(a, b) {
    if ((b | 0) === 0) {
      return 0;
    }
    return Number((BigInt(a | 0) << BigInt(FIXED_SHIFT)) / BigInt(b | 0)) | 0;
  }

  function fixedFromNumber(value) {
    return Math.round(value * FIXED_ONE) | 0;
  }

  function fixedToNumber(raw) {
    return (raw | 0) / FIXED_ONE;
  }

  function normalizeRigidBody(component) {
    return {
      position: parseVec2Raw(readMember(component, "position"), 0, 0),
      velocity: parseVec2Raw(readMember(component, "velocity"), 0, 0),
      angle: parseFixedRaw(readMember(component, "angle"), 0),
      angularVelocity: parseFixedRaw(readMember(component, "angularVelocity"), 0),
      mass: parseFixedRaw(readMember(component, "mass"), FIXED_ONE),
      invMass: parseFixedRaw(readMember(component, "invMass"), FIXED_ONE),
      inertia: parseFixedRaw(readMember(component, "inertia"), FIXED_ONE),
      invInertia: parseFixedRaw(readMember(component, "invInertia"), FIXED_ONE),
      restitution: parseFixedRaw(readMember(component, "restitution"), fixedFromNumber(0.3)),
      friction: parseFixedRaw(readMember(component, "friction"), fixedFromNumber(0.5)),
      linearDamping: parseFixedRaw(readMember(component, "linearDamping"), fixedFromNumber(0.01)),
      angularDamping: parseFixedRaw(readMember(component, "angularDamping"), fixedFromNumber(0.01)),
      isStatic: Boolean(readMember(component, "isStatic")),
      isSleeping: Boolean(readMember(component, "isSleeping")),
      sleepTimer: toInt(readMember(component, "sleepTimer"), 0)
    };
  }

  function normalizeCollider(component) {
    return {
      shapeType: String(readMember(component, "shapeType") ?? "circle"),
      radius: parseFixedRaw(readMember(component, "radius"), FIXED_ONE),
      halfExtents: parseVec2Raw(readMember(component, "halfExtents"), FIXED_ONE, FIXED_ONE),
      offset: parseVec2Raw(readMember(component, "offset"), 0, 0),
      angle: parseFixedRaw(readMember(component, "angle"), 0),
      collisionMask: toInt(readMember(component, "collisionMask"), -1)
    };
  }

  function normalizeStructural(component) {
    return {
      nodeCount: toInt(readMember(component, "nodeCount"), 0),
      fractured: Boolean(readMember(component, "fractured")),
      centreOfMass: parseVec2Raw(readMember(component, "centreOfMass"), 0, 0),
      mass: parseFixedRaw(readMember(component, "mass"), FIXED_ONE),
      inertia: parseFixedRaw(readMember(component, "inertia"), FIXED_ONE)
    };
  }

  function normalizeForceCommand(component) {
    return {
      force: parseVec2Raw(readMember(component, "force"), 0, 0)
    };
  }

  function normalizeComponent(typeName, component) {
    if (typeName === RIGID_BODY_TYPE) {
      return normalizeRigidBody(component);
    }
    if (typeName === COLLIDER_TYPE) {
      return normalizeCollider(component);
    }
    if (typeName === STRUCTURAL_TYPE) {
      return normalizeStructural(component);
    }
    if (typeName === FORCE_COMMAND_TYPE) {
      return normalizeForceCommand(component);
    }
    return component;
  }

  function materializeRigidBody(component) {
    const j = java();
    return new j.JRigidBody(
      j.vec2OfRaw(component.position),
      j.vec2OfRaw(component.velocity),
      j.fixedOfRaw(component.angle),
      j.fixedOfRaw(component.angularVelocity),
      j.fixedOfRaw(component.mass),
      j.fixedOfRaw(component.invMass),
      j.fixedOfRaw(component.inertia),
      j.fixedOfRaw(component.invInertia),
      j.fixedOfRaw(component.restitution),
      j.fixedOfRaw(component.friction),
      j.fixedOfRaw(component.linearDamping),
      j.fixedOfRaw(component.angularDamping),
      Boolean(component.isStatic),
      Boolean(component.isSleeping),
      toInt(component.sleepTimer, 0)
    );
  }

  function materializeCollider(component) {
    const j = java();
    const halfExtents = component.halfExtents ? j.vec2OfRaw(component.halfExtents) : null;
    return new j.JCollider(
      String(component.shapeType),
      j.fixedOfRaw(component.radius),
      halfExtents,
      j.vec2OfRaw(component.offset ?? { x: 0, y: 0 }),
      j.fixedOfRaw(component.angle),
      toInt(component.collisionMask, -1)
    );
  }

  function materializeStructural(component) {
    const j = java();
    return new j.JStructural(
      toInt(component.nodeCount, 0),
      Boolean(component.fractured),
      j.vec2OfRaw(component.centreOfMass ?? { x: 0, y: 0 }),
      j.fixedOfRaw(component.mass),
      j.fixedOfRaw(component.inertia)
    );
  }

  function deepClone(value) {
    if (value == null || typeof value !== "object") {
      return value;
    }
    if (typeof value.getClass === "function") {
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(deepClone);
    }
    if (ArrayBuffer.isView(value)) {
      return value.slice();
    }
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = deepClone(item);
    }
    return out;
  }

  function materializeComponent(typeName, component) {
    if (component == null) {
      return null;
    }
    if (typeName === RIGID_BODY_TYPE) {
      return materializeRigidBody(component);
    }
    if (typeName === COLLIDER_TYPE) {
      return materializeCollider(component);
    }
    if (typeName === STRUCTURAL_TYPE) {
      return materializeStructural(component);
    }
    return component;
  }

  function createWorld() {
    const entities = new Map();
    const componentIndex = new Map();
    const eventHandlers = new Map();
    const physics = {
      enabled: false,
      gravityY: fixedFromNumber(-9.8),
      previousCollisions: new Set(),
      seenFractures: new Set()
    };
    let nextEntityId = 1;

    function cloneComponents(components) {
      const clone = new Map();
      for (const [typeName, value] of components.entries()) {
        clone.set(typeName, deepClone(value));
      }
      return clone;
    }

    function addToIndex(typeName, entityId) {
      let ids = componentIndex.get(typeName);
      if (!ids) {
        ids = new Set();
        componentIndex.set(typeName, ids);
      }
      ids.add(entityId);
    }

    function removeFromIndex(typeName, entityId) {
      const ids = componentIndex.get(typeName);
      if (!ids) {
        return;
      }
      ids.delete(entityId);
      if (ids.size === 0) {
        componentIndex.delete(typeName);
      }
    }

    function ensureEntity(entityId) {
      let components = entities.get(entityId);
      if (!components) {
        components = new Map();
        entities.set(entityId, components);
      }
      return components;
    }

    function reserveEntityId() {
      while (entities.has(nextEntityId)) {
        nextEntityId += 1;
      }
      const id = nextEntityId;
      nextEntityId += 1;
      return id;
    }

    function applyBatch(operations) {
      if (!Array.isArray(operations)) {
        if (operations && typeof operations.length === "number") {
          operations = Array.from(operations);
        } else if (operations && typeof operations[Symbol.iterator] === "function") {
          operations = Array.from(operations);
        } else {
          throw new Error("applyBatch expects an array of operations");
        }
      }
      const rollback = [];

      try {
        for (const operation of operations) {
          const kind = operation.kind;
          const entityId = Number(operation.entityId);

          if (!Number.isInteger(entityId) || entityId <= 0) {
            throw new Error(`Invalid entity id: ${String(operation.entityId)}`);
          }

          if (kind === "spawn") {
            if (entities.has(entityId)) {
              throw new Error(`Entity ${entityId} already exists`);
            }
            entities.set(entityId, new Map());
            rollback.push({ kind: "despawn", entityId });
            if (entityId >= nextEntityId) {
              nextEntityId = entityId + 1;
            }
            continue;
          }

          if (kind === "despawn") {
            const prior = entities.get(entityId);
            if (!prior) {
              throw new Error(`Cannot despawn missing entity ${entityId}`);
            }
            entities.delete(entityId);
            for (const typeName of prior.keys()) {
              removeFromIndex(typeName, entityId);
            }
            rollback.push({ kind: "restore", entityId, components: cloneComponents(prior) });
            continue;
          }

          if (kind === "add") {
            const components = ensureEntity(entityId);
            const typeName = String(operation.typeName);
            const hadPrevious = components.has(typeName);
            const previous = components.get(typeName);
            components.set(typeName, normalizeComponent(typeName, operation.component));
            addToIndex(typeName, entityId);
            rollback.push({ kind: "undoAdd", entityId, typeName, hadPrevious, previous });
            if (entityId >= nextEntityId) {
              nextEntityId = entityId + 1;
            }
            continue;
          }

          if (kind === "remove") {
            const components = entities.get(entityId);
            if (!components) {
              throw new Error(`Cannot remove component from missing entity ${entityId}`);
            }
            const typeName = String(operation.typeName);
            const hadPrevious = components.has(typeName);
            const previous = components.get(typeName);
            components.delete(typeName);
            removeFromIndex(typeName, entityId);
            rollback.push({ kind: "undoRemove", entityId, typeName, hadPrevious, previous });
            continue;
          }

          throw new Error(`Unknown command kind: ${String(kind)}`);
        }
      } catch (error) {
        for (let i = rollback.length - 1; i >= 0; i -= 1) {
          const entry = rollback[i];
          if (entry.kind === "despawn") {
            entities.delete(entry.entityId);
            continue;
          }
          if (entry.kind === "restore") {
            entities.set(entry.entityId, entry.components);
            for (const typeName of entry.components.keys()) {
              addToIndex(typeName, entry.entityId);
            }
            continue;
          }
          if (entry.kind === "undoAdd") {
            const components = ensureEntity(entry.entityId);
            if (entry.hadPrevious) {
              components.set(entry.typeName, entry.previous);
              addToIndex(entry.typeName, entry.entityId);
            } else {
              components.delete(entry.typeName);
              removeFromIndex(entry.typeName, entry.entityId);
            }
            continue;
          }
          if (entry.kind === "undoRemove") {
            const components = ensureEntity(entry.entityId);
            if (entry.hadPrevious) {
              components.set(entry.typeName, entry.previous);
              addToIndex(entry.typeName, entry.entityId);
            } else {
              components.delete(entry.typeName);
              removeFromIndex(entry.typeName, entry.entityId);
            }
          }
        }
        throw error;
      }
    }

    function normalizedTypes(types) {
      if (!Array.isArray(types)) {
        return [];
      }
      const out = [];
      const seen = new Set();
      for (const rawTypeName of types) {
        const typeName = String(rawTypeName);
        if (!seen.has(typeName)) {
          seen.add(typeName);
          out.push(typeName);
        }
      }
      return out;
    }

    function candidateEntityIds(required) {
      if (required.length === 0) {
        return Array.from(entities.keys());
      }

      let smallest = null;
      for (const typeName of required) {
        const ids = componentIndex.get(typeName);
        if (!ids || ids.size === 0) {
          return [];
        }
        if (!smallest || ids.size < smallest.size) {
          smallest = ids;
        }
      }

      return Array.from(smallest);
    }

    function query(required, optional, without) {
      const requiredTypes = normalizedTypes(required);
      const withoutTypes = normalizedTypes(without);
      const optionalTypes = normalizedTypes(optional).filter(
        (typeName) => !withoutTypes.includes(typeName) && !requiredTypes.includes(typeName)
      );

      const result = [];
      const candidates = candidateEntityIds(requiredTypes);
      candidates.sort((a, b) => a - b);

      for (const entity of candidates) {
        const components = entities.get(entity);
        if (!components) {
          continue;
        }

        let matches = true;

        for (const typeName of requiredTypes) {
          if (!components.has(typeName)) {
            matches = false;
            break;
          }
        }
        if (!matches) {
          continue;
        }

        for (const typeName of withoutTypes) {
          if (components.has(typeName)) {
            matches = false;
            break;
          }
        }
        if (!matches) {
          continue;
        }

        const row = { entity, components: {} };
        for (const typeName of requiredTypes) {
          row.components[typeName] = materializeComponent(typeName, components.get(typeName));
        }
        for (const typeName of optionalTypes) {
          const value = components.get(typeName);
          row.components[typeName] = value == null ? null : materializeComponent(typeName, value);
        }
        result.push(row);
      }

      return result;
    }

    function subscribeEvent(eventType, handler) {
      let handlers = eventHandlers.get(eventType);
      if (!handlers) {
        handlers = [];
        eventHandlers.set(eventType, handlers);
      }
      handlers.push(handler);
    }

    function emitEvent(eventType, payload) {
      const handlers = eventHandlers.get(eventType);
      if (!handlers) {
        return;
      }
      for (const handler of handlers) {
        handler(payload);
      }
    }

    function snapshot() {
      const rows = [];
      for (const [entityId, components] of entities.entries()) {
        rows.push({
          entityId,
          components: Object.fromEntries(components.entries())
        });
      }
      rows.sort((a, b) => a.entityId - b.entityId);
      return {
        nextEntityId,
        physics: {
          enabled: physics.enabled,
          gravityY: physics.gravityY,
          previousCollisions: Array.from(physics.previousCollisions),
          seenFractures: Array.from(physics.seenFractures)
        },
        entities: rows
      };
    }

    function restore(state) {
      if (!state || typeof state !== "object") {
        throw new Error("restore expects a snapshot object");
      }
      const restoredRows = Array.isArray(state.entities) ? state.entities : [];

      entities.clear();
      componentIndex.clear();

      let maxEntityId = 0;
      for (const row of restoredRows) {
        const entityId = Number(row.entityId);
        if (!Number.isInteger(entityId) || entityId <= 0) {
          throw new Error(`Invalid snapshot entity id: ${String(row.entityId)}`);
        }
        const componentsMap = new Map();
        const componentsObject = row.components && typeof row.components === "object" ? row.components : {};
        for (const [typeName, value] of Object.entries(componentsObject)) {
          componentsMap.set(typeName, normalizeComponent(typeName, value));
          addToIndex(typeName, entityId);
        }
        entities.set(entityId, componentsMap);
        if (entityId > maxEntityId) {
          maxEntityId = entityId;
        }
      }

      const snapshotNextId = Number(state.nextEntityId);
      if (Number.isInteger(snapshotNextId) && snapshotNextId > 0) {
        nextEntityId = Math.max(snapshotNextId, maxEntityId + 1);
      } else {
        nextEntityId = maxEntityId + 1;
      }

      const physicsState = state.physics && typeof state.physics === "object" ? state.physics : null;
      physics.enabled = Boolean(physicsState && physicsState.enabled);
      physics.gravityY = parseFixedRaw(physicsState && physicsState.gravityY, fixedFromNumber(-9.8));
      physics.previousCollisions = new Set(Array.isArray(physicsState && physicsState.previousCollisions)
        ? physicsState.previousCollisions.map((v) => String(v))
        : []);
      physics.seenFractures = new Set(Array.isArray(physicsState && physicsState.seenFractures)
        ? physicsState.seenFractures.map((v) => Number(v))
        : []);
    }

    function pairKey(entityA, entityB) {
      const lo = entityA < entityB ? entityA : entityB;
      const hi = entityA < entityB ? entityB : entityA;
      return `${lo}:${hi}`;
    }

    function emitCollisionStarted(entityA, entityB, pointRaw, normalRaw) {
      const j = java();
      if (!Number.isInteger(entityA) || !Number.isInteger(entityB)) {
        throw new Error("CollisionStarted payload schema mismatch: entity ids must be integers");
      }
      const point = j.vec2OfRaw(pointRaw);
      const normal = j.vec2OfRaw(normalRaw);
      emitEvent("com.quietterminal.clockwork.plugins.CollisionStartedEvent", new j.JCollisionStartedEvent(entityA, entityB, point, normal));
    }

    function emitCollisionEnded(entityA, entityB) {
      const j = java();
      if (!Number.isInteger(entityA) || !Number.isInteger(entityB)) {
        throw new Error("CollisionEnded payload schema mismatch: entity ids must be integers");
      }
      emitEvent("com.quietterminal.clockwork.plugins.CollisionEndedEvent", new j.JCollisionEndedEvent(entityA, entityB));
    }

    function emitBodyFractured(source) {
      const j = java();
      if (!Number.isInteger(source)) {
        throw new Error("BodyFractured payload schema mismatch: source must be an integer");
      }
      emitEvent(
        "com.quietterminal.clockwork.plugins.BodyFracturedEvent",
        new j.JBodyFracturedEvent(source, Java.to([], "long[]"))
      );
    }

    function stepPhysics(fixedDeltaSeconds) {
      if (!physics.enabled) {
        return;
      }

      const dtRaw = fixedFromNumber(fixedDeltaSeconds);
      const entityIds = Array.from(entities.keys()).sort((a, b) => a - b);

      for (const entityId of entityIds) {
        const components = entities.get(entityId);
        if (!components) {
          continue;
        }

        const body = components.get(RIGID_BODY_TYPE);
        if (!body) {
          continue;
        }

        const forceCommand = components.get(FORCE_COMMAND_TYPE);
        let force = { x: 0, y: 0 };
        if (forceCommand && forceCommand.force) {
          force = forceCommand.force;
          components.delete(FORCE_COMMAND_TYPE);
          removeFromIndex(FORCE_COMMAND_TYPE, entityId);
        }

        if (body.isStatic || body.isSleeping) {
          continue;
        }

        const forceAccelX = fixedMul(force.x, body.invMass);
        const forceAccelY = fixedMul(force.y, body.invMass);
        const accelY = fixedAdd(forceAccelY, physics.gravityY);

        body.velocity.x = fixedAdd(body.velocity.x, fixedMul(forceAccelX, dtRaw));
        body.velocity.y = fixedAdd(body.velocity.y, fixedMul(accelY, dtRaw));

        body.position.x = fixedAdd(body.position.x, fixedMul(body.velocity.x, dtRaw));
        body.position.y = fixedAdd(body.position.y, fixedMul(body.velocity.y, dtRaw));
        body.angle = fixedAdd(body.angle, fixedMul(body.angularVelocity, dtRaw));

        const linearDampingFactor = fixedSub(FIXED_ONE, fixedMul(body.linearDamping, dtRaw));
        const angularDampingFactor = fixedSub(FIXED_ONE, fixedMul(body.angularDamping, dtRaw));

        body.velocity.x = fixedMul(body.velocity.x, Math.max(0, linearDampingFactor));
        body.velocity.y = fixedMul(body.velocity.y, Math.max(0, linearDampingFactor));
        body.angularVelocity = fixedMul(body.angularVelocity, Math.max(0, angularDampingFactor));
      }

      const currentCollisions = new Set();
      for (let i = 0; i < entityIds.length; i += 1) {
        const entityA = entityIds[i];
        const componentsA = entities.get(entityA);
        if (!componentsA) {
          continue;
        }
        const bodyA = componentsA.get(RIGID_BODY_TYPE);
        const colliderA = componentsA.get(COLLIDER_TYPE);
        if (!bodyA || !colliderA || colliderA.shapeType !== "circle") {
          continue;
        }

        for (let j = i + 1; j < entityIds.length; j += 1) {
          const entityB = entityIds[j];
          const componentsB = entities.get(entityB);
          if (!componentsB) {
            continue;
          }
          const bodyB = componentsB.get(RIGID_BODY_TYPE);
          const colliderB = componentsB.get(COLLIDER_TYPE);
          if (!bodyB || !colliderB || colliderB.shapeType !== "circle") {
            continue;
          }

          if ((colliderA.collisionMask & colliderB.collisionMask) === 0) {
            continue;
          }

          const dx = fixedSub(bodyB.position.x, bodyA.position.x);
          const dy = fixedSub(bodyB.position.y, bodyA.position.y);
          const distSq = fixedAdd(fixedMul(dx, dx), fixedMul(dy, dy));
          const radius = fixedAdd(colliderA.radius, colliderB.radius);
          const radiusSq = fixedMul(radius, radius);
          if (distSq > radiusSq) {
            continue;
          }

          const key = pairKey(entityA, entityB);
          currentCollisions.add(key);

          if (!physics.previousCollisions.has(key)) {
            const pointRaw = {
              x: fixedDiv(fixedAdd(bodyA.position.x, bodyB.position.x), fixedFromNumber(2)),
              y: fixedDiv(fixedAdd(bodyA.position.y, bodyB.position.y), fixedFromNumber(2))
            };

            let normalRaw;
            if (distSq === 0) {
              normalRaw = { x: FIXED_ONE, y: 0 };
            } else {
              const len = Math.sqrt(fixedToNumber(distSq));
              normalRaw = {
                x: fixedFromNumber(fixedToNumber(dx) / len),
                y: fixedFromNumber(fixedToNumber(dy) / len)
              };
            }

            emitCollisionStarted(entityA, entityB, pointRaw, normalRaw);
          }
        }
      }

      for (const key of physics.previousCollisions) {
        if (currentCollisions.has(key)) {
          continue;
        }
        const [a, b] = key.split(":").map((part) => Number(part));
        emitCollisionEnded(a, b);
      }
      physics.previousCollisions = currentCollisions;

      for (const entityId of entityIds) {
        const components = entities.get(entityId);
        if (!components) {
          continue;
        }
        const structural = components.get(STRUCTURAL_TYPE);
        if (!structural) {
          physics.seenFractures.delete(entityId);
          continue;
        }
        if (structural.fractured) {
          if (!physics.seenFractures.has(entityId)) {
            emitBodyFractured(entityId);
            physics.seenFractures.add(entityId);
          }
        } else {
          physics.seenFractures.delete(entityId);
        }
      }
    }

    function enablePhysics(config) {
      physics.enabled = true;
      physics.gravityY = parseFixedRaw(readMember(config, "gravity"), fixedFromNumber(-9.8));
    }

    return {
      reserveEntityId,
      applyBatch,
      query,
      subscribeEvent,
      emitEvent,
      snapshot,
      restore,
      enablePhysics,
      stepPhysics
    };
  }

  function createBridgeApi() {
    const systems = {
      BOOT: [],
      PRE_UPDATE: [],
      FIXED_UPDATE: [],
      UPDATE: [],
      LATE_UPDATE: [],
      RENDER_PREP: [],
      RENDER: [],
      POST_RENDER: [],
      SHUTDOWN: []
    };
    const worlds = [];
    const MAX_FIXED_STEPS_PER_FRAME = 8;
    let fixedAccumulator = 0;
    let bootExecuted = false;

    function executeSystems(callbacks, tick, deltaSeconds, fixedDeltaSeconds) {
      for (const callback of callbacks) {
        callback(tick, deltaSeconds, fixedDeltaSeconds);
      }
    }

    return {
      createWorld() {
        const world = createWorld();
        worlds.push(world);
        return world;
      },
      registerSystem(stage, callback) {
        const bucket = systems[stage];
        if (!bucket) {
          throw new Error(`Unknown stage: ${String(stage)}`);
        }
        bucket.push(callback);
      },
      step(tick, deltaSeconds, fixedDeltaSeconds) {
        if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
          throw new Error("deltaSeconds must be a positive finite number");
        }
        if (!Number.isFinite(fixedDeltaSeconds) || fixedDeltaSeconds <= 0) {
          throw new Error("fixedDeltaSeconds must be a positive finite number");
        }

        if (!bootExecuted) {
          executeSystems(systems.BOOT, tick, deltaSeconds, fixedDeltaSeconds);
          bootExecuted = true;
        }

        executeSystems(systems.PRE_UPDATE, tick, deltaSeconds, fixedDeltaSeconds);

        const clamp = fixedDeltaSeconds * MAX_FIXED_STEPS_PER_FRAME;
        fixedAccumulator = Math.min(fixedAccumulator + deltaSeconds, clamp);

        let fixedSteps = 0;
        while (fixedAccumulator >= fixedDeltaSeconds && fixedSteps < MAX_FIXED_STEPS_PER_FRAME) {
          for (const world of worlds) {
            world.stepPhysics(fixedDeltaSeconds);
          }
          executeSystems(systems.FIXED_UPDATE, tick, deltaSeconds, fixedDeltaSeconds);
          fixedAccumulator -= fixedDeltaSeconds;
          fixedSteps += 1;
        }

        executeSystems(systems.UPDATE, tick, deltaSeconds, fixedDeltaSeconds);
        executeSystems(systems.LATE_UPDATE, tick, deltaSeconds, fixedDeltaSeconds);
        executeSystems(systems.RENDER_PREP, tick, deltaSeconds, fixedDeltaSeconds);
        executeSystems(systems.RENDER, tick, deltaSeconds, fixedDeltaSeconds);
        executeSystems(systems.POST_RENDER, tick, deltaSeconds, fixedDeltaSeconds);
      },
      shutdown(tick, fixedDeltaSeconds) {
        executeSystems(systems.SHUTDOWN, tick, 0, fixedDeltaSeconds);
      },
      dispose() {
        systems.BOOT.length = 0;
        systems.PRE_UPDATE.length = 0;
        systems.FIXED_UPDATE.length = 0;
        systems.UPDATE.length = 0;
        systems.LATE_UPDATE.length = 0;
        systems.RENDER_PREP.length = 0;
        systems.RENDER.length = 0;
        systems.POST_RENDER.length = 0;
        systems.SHUTDOWN.length = 0;
        worlds.length = 0;
        fixedAccumulator = 0;
        bootExecuted = false;
      }
    };
  }

  globalThis.ClockworkJVM = {
    bundleVersion: "0.1.0",
    bridgeApiVersion: 2,
    createBridgeApi,
    AppBuilder() {
      return {
        use() {
          return this;
        },
        build() {
          return {};
        }
      };
    }
  };
})();
