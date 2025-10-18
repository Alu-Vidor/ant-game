import { useEffect, useMemo, useReducer, useState } from 'react';
import './App.css';

type ResourceType = 'leaves' | 'nectar' | 'grit';
type GamePhase = 'day' | 'night';
type Structure = 'storage' | 'feeding' | 'incubator';
type PriorityPreset = 'balanced' | 'food' | 'build';

type NodeStatus = 'locked' | 'discovered' | 'active';

interface ResourceNode {
  id: string;
  type: ResourceType;
  label: string;
  description: string;
  richness: number;
  status: NodeStatus;
  traffic: number;
  x: number;
  y: number;
}

interface ExplorationParty {
  id: number;
  workers: number;
  timer: number;
}

type GameAction =
  | { type: 'tick' }
  | { type: 'assign'; resource: ResourceType }
  | { type: 'recall'; resource: ResourceType }
  | { type: 'build'; structure: Structure }
  | { type: 'promoteScout' }
  | { type: 'advanceColony' }
  | { type: 'acknowledgeVictory' }
  | { type: 'preset'; preset: PriorityPreset }
  | { type: 'explore' }
  | { type: 'revealNode'; id: string };

interface GameState {
  tick: number;
  phase: GamePhase;
  resources: Record<ResourceType, number>;
  capacity: number;
  workers: number;
  freeWorkers: number;
  assignments: Record<ResourceType, number>;
  scouts: number;
  structures: Record<Structure, number>;
  queenProgress: number;
  colonyLevel: number;
  victory: boolean;
  colonyProgress: number;
  defeatCounter: number;
  productionFrozen: boolean;
  log: string[];
  resourceNodes: ResourceNode[];
  explorationParties: ExplorationParty[];
  nextExplorationId: number;
  explorationPoints: number;
  buildPulseUntil: number;
  explorationPulseUntil: number;
}

const TICKS_PER_SECOND = 4;
const TICK_INTERVAL = 1000 / TICKS_PER_SECOND;
const DAY_LENGTH = 120;
const NIGHT_START = 90;
const BASE_CAPACITY = 120;
const STORAGE_BONUS = 60;
const BASE_PRODUCTION = 0.45;
const NIGHT_MULTIPLIER = 0.7;
const SCOUT_BONUS = 0.05;
const BASE_NECTAR_USE = 0.1;
const FEEDING_REDUCTION = 0.12;
const QUEEN_THRESHOLD = 18;
const FREEZE_THRESHOLD = 16;
const EXPLORATION_DURATION = 18;

function createInitialNodes(): ResourceNode[] {
  return [
    {
      id: 'leaves-1',
      type: 'leaves',
      label: 'Узел листьев #1',
      description: 'Куст с молодыми листьями, подходит для раннего сбора.',
      richness: 1,
      status: 'active',
      traffic: 0,
      x: 68,
      y: 32,
    },
    {
      id: 'nectar-1',
      type: 'nectar',
      label: 'Цветы росы',
      description: 'Гроздь цветков, дающая стабильный поток нектара.',
      richness: 1,
      status: 'discovered',
      traffic: 0,
      x: 28,
      y: 28,
    },
    {
      id: 'grit-1',
      type: 'grit',
      label: 'Песчаная тропа',
      description: 'Рыхлый песок и веточки для укрепления ходов.',
      richness: 0.8,
      status: 'discovered',
      traffic: 0,
      x: 20,
      y: 65,
    },
    {
      id: 'leaves-2',
      type: 'leaves',
      label: 'Узел листьев #2',
      description: 'Листья крупные, но охраняются жуками.',
      richness: 1.2,
      status: 'locked',
      traffic: 0,
      x: 78,
      y: 68,
    },
    {
      id: 'nectar-2',
      type: 'nectar',
      label: 'Соки дерева',
      description: 'Смолистая поверхность с редкими каплями нектара.',
      richness: 1.5,
      status: 'locked',
      traffic: 0,
      x: 45,
      y: 82,
    },
    {
      id: 'grit-2',
      type: 'grit',
      label: 'Галька ручья',
      description: 'Твёрдый материал для укрепления стен.',
      richness: 1.3,
      status: 'locked',
      traffic: 0,
      x: 12,
      y: 45,
    },
  ];
}

function createInitialState(): GameState {
  return {
    tick: 0,
    phase: 'day',
    resources: {
      leaves: 20,
      nectar: 25,
      grit: 10,
    },
    capacity: BASE_CAPACITY,
    workers: 6,
    freeWorkers: 3,
    assignments: {
      leaves: 2,
      nectar: 1,
      grit: 0,
    },
    scouts: 0,
    structures: {
      storage: 0,
      feeding: 0,
      incubator: 0,
    },
    queenProgress: 0,
    colonyLevel: 1,
    victory: false,
    colonyProgress: 0,
    defeatCounter: 0,
    productionFrozen: false,
    log: [
      'Матка пробуждается и колония начинает собирать первые ресурсы.',
      'Назначьте рабочих и постройте ключевые камеры, чтобы достичь 10 уровня.',
    ],
    resourceNodes: createInitialNodes(),
    explorationParties: [],
    nextExplorationId: 1,
    explorationPoints: 0,
    buildPulseUntil: 0,
    explorationPulseUntil: 0,
  };
}

const INITIAL_STATE = createInitialState();

function clampResource(value: number, capacity: number) {
  return Math.min(Math.max(value, 0), capacity);
}

function getPhase(tick: number): GamePhase {
  const cycleTick = tick % DAY_LENGTH;
  return cycleTick >= NIGHT_START ? 'night' : 'day';
}

function formatResources(resources: Record<ResourceType, number>) {
  return {
    leaves: resources.leaves.toFixed(1),
    nectar: resources.nectar.toFixed(1),
    grit: resources.grit.toFixed(1),
  };
}

function addLog(log: string[], entry: string) {
  return [entry, ...log].slice(0, 8);
}

function structureName(structure: Structure) {
  switch (structure) {
    case 'storage':
      return 'Склад';
    case 'feeding':
      return 'Кормовая камера';
    case 'incubator':
      return 'Инкубатор';
    default:
      return structure;
  }
}

function allocatePreset(totalWorkers: number, preset: PriorityPreset) {
  if (totalWorkers <= 0) {
    return { leaves: 0, nectar: 0, grit: 0 } as Record<ResourceType, number>;
  }

  const ratios: Record<PriorityPreset, Record<ResourceType, number>> = {
    balanced: { leaves: 0.4, nectar: 0.35, grit: 0.25 },
    food: { leaves: 0.2, nectar: 0.6, grit: 0.2 },
    build: { leaves: 0.45, nectar: 0.2, grit: 0.35 },
  };

  const distribution = ratios[preset];
  const assigned: Record<ResourceType, number> = {
    leaves: 0,
    nectar: 0,
    grit: 0,
  };

  let remaining = totalWorkers;
  const ordered = (Object.keys(distribution) as ResourceType[]).sort(
    (a, b) => distribution[b] - distribution[a]
  );

  ordered.forEach((resource, index) => {
    if (index === ordered.length - 1) {
      assigned[resource] = remaining;
      remaining = 0;
      return;
    }
    const value = Math.round(totalWorkers * distribution[resource]);
    assigned[resource] = Math.min(value, remaining);
    remaining -= assigned[resource];
  });

  return assigned;
}

function updateResourceNodes(nodes: ResourceNode[], assignments: Record<ResourceType, number>) {
  return nodes.map((node) => {
    if (node.status === 'locked') {
      return node;
    }
    const assigned = assignments[node.type];
    const targetTraffic = Math.min(1, assigned / 6);
    const smoothedTraffic = node.traffic + (targetTraffic - node.traffic) * 0.25;
    let status: NodeStatus = node.status;
    if (assigned > 0 && node.status !== 'active') {
      status = 'active';
    }
    if (assigned === 0 && node.status === 'active') {
      status = 'discovered';
    }
    return {
      ...node,
      status,
      traffic: Number(smoothedTraffic.toFixed(3)),
    };
  });
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'assign': {
      if (state.freeWorkers <= 0) return state;
      return {
        ...state,
        freeWorkers: state.freeWorkers - 1,
        assignments: {
          ...state.assignments,
          [action.resource]: state.assignments[action.resource] + 1,
        },
      };
    }
    case 'recall': {
      if (state.assignments[action.resource] <= 0) return state;
      return {
        ...state,
        freeWorkers: state.freeWorkers + 1,
        assignments: {
          ...state.assignments,
          [action.resource]: state.assignments[action.resource] - 1,
        },
      };
    }
    case 'build': {
      const costs: Record<Structure, Partial<Record<ResourceType, number>>> = {
        storage: { leaves: 35, grit: 12 },
        feeding: { leaves: 30, nectar: 25 },
        incubator: { leaves: 45, grit: 20 },
      };
      const structureLevel = state.structures[action.structure];
      if (structureLevel >= 3) return state;
      const cost = costs[action.structure];
      for (const [resource, amount] of Object.entries(cost)) {
        const key = resource as ResourceType;
        if (state.resources[key] < (amount ?? 0)) {
          return state;
        }
      }
      const updatedResources = { ...state.resources };
      Object.entries(cost).forEach(([resource, amount]) => {
        const key = resource as ResourceType;
        updatedResources[key] -= amount ?? 0;
      });
      let capacity = state.capacity;
      if (action.structure === 'storage') {
        capacity += STORAGE_BONUS;
      }
      return {
        ...state,
        resources: updatedResources,
        structures: {
          ...state.structures,
          [action.structure]: structureLevel + 1,
        },
        capacity,
        buildPulseUntil: state.tick + 16,
        log: addLog(
          state.log,
          `Построена ${structureName(action.structure)} (уровень ${structureLevel + 1}).`
        ),
      };
    }
    case 'promoteScout': {
      if (state.workers <= 0 || state.resources.nectar < 40) {
        return state;
      }
      const updatedAssignments: Record<ResourceType, number> = {
        ...state.assignments,
      };
      if (state.freeWorkers > 0) {
        return {
          ...state,
          workers: state.workers - 1,
          freeWorkers: state.freeWorkers - 1,
          scouts: state.scouts + 1,
          resources: {
            ...state.resources,
            nectar: state.resources.nectar - 40,
          },
          explorationPoints: state.explorationPoints + 1,
          log: addLog(
            state.log,
            'Один из рабочих стал разведчиком и расширил границы обзора.'
          ),
        };
      }
      const resourceWithWorker = (Object.keys(updatedAssignments) as ResourceType[]).find(
        (resource) => updatedAssignments[resource] > 0
      );
      if (!resourceWithWorker) {
        return state;
      }
      updatedAssignments[resourceWithWorker] -= 1;
      return {
        ...state,
        workers: state.workers - 1,
        assignments: updatedAssignments,
        scouts: state.scouts + 1,
        resources: {
          ...state.resources,
          nectar: state.resources.nectar - 40,
        },
        explorationPoints: state.explorationPoints + 1,
        log: addLog(
          state.log,
          'Один из рабочих стал разведчиком и расширил границы обзора.'
        ),
      };
    }
    case 'advanceColony': {
      if (state.colonyLevel >= 10) {
        return state;
      }
      const baseCost = 60 + state.colonyLevel * 20;
      const nectarCost = 35 + state.colonyLevel * 10;
      const gritCost = Math.max(10, 15 + state.colonyLevel * 5);
      if (
        state.resources.leaves < baseCost ||
        state.resources.nectar < nectarCost ||
        state.resources.grit < gritCost
      ) {
        return state;
      }
      const updatedResources = {
        leaves: state.resources.leaves - baseCost,
        nectar: state.resources.nectar - nectarCost,
        grit: state.resources.grit - gritCost,
      };
      const nextLevel = state.colonyLevel + 1;
      const victory = nextLevel >= 10;
      return {
        ...state,
        resources: updatedResources,
        colonyLevel: nextLevel,
        colonyProgress: 0,
        victory,
        log: addLog(
          state.log,
          victory
            ? 'Колония достигла легендарного 10 уровня! Муравейник признан процветающим.'
            : `Колония усилилась и достигла ${nextLevel} уровня.`
        ),
      };
    }
    case 'acknowledgeVictory': {
      return {
        ...state,
        victory: false,
      };
    }
    case 'preset': {
      const exploringWorkers = state.explorationParties.reduce((sum, party) => sum + party.workers, 0);
      const totalAvailable = state.workers - state.scouts - exploringWorkers;
      if (totalAvailable <= 0) {
        return state;
      }
      const assigned = allocatePreset(totalAvailable, action.preset);
      const used = assigned.leaves + assigned.nectar + assigned.grit;
      const freeWorkers = Math.max(0, totalAvailable - used);
      return {
        ...state,
        assignments: assigned,
        freeWorkers,
        log: addLog(
          state.log,
          action.preset === 'balanced'
            ? 'Приоритеты сбалансированы для стабильного роста.'
            : action.preset === 'food'
            ? 'Режим «Еда сначала»: больше рабочих ищут нектар.'
            : 'Режим «Стройка сначала»: собираем материалы.'
        ),
      };
    }
    case 'explore': {
      if (state.freeWorkers <= 0) {
        return state;
      }
      const explorers = Math.min(2, state.freeWorkers);
      const party: ExplorationParty = {
        id: state.nextExplorationId,
        workers: explorers,
        timer: EXPLORATION_DURATION,
      };
      return {
        ...state,
        freeWorkers: state.freeWorkers - explorers,
        explorationParties: [...state.explorationParties, party],
        nextExplorationId: state.nextExplorationId + 1,
        explorationPulseUntil: state.tick + 24,
        log: addLog(
          state.log,
          `Разведка: ${explorers} рабочих покинули гнездо в поисках новых узлов.`
        ),
      };
    }
    case 'revealNode': {
      const index = state.resourceNodes.findIndex((node) => node.id === action.id);
      if (index === -1) return state;
      const node = state.resourceNodes[index];
      if (node.status !== 'locked' || state.explorationPoints <= 0) {
        return state;
      }
      const updatedNodes = [...state.resourceNodes];
      updatedNodes[index] = { ...node, status: 'discovered' };
      return {
        ...state,
        resourceNodes: updatedNodes,
        explorationPoints: state.explorationPoints - 1,
        log: addLog(state.log, `${node.label} открыт для добычи.`),
      };
    }
    case 'tick': {
      const nextTick = state.tick + 1;
      const phase = getPhase(nextTick);
      const productionModifier =
        (phase === 'day' ? 1 : NIGHT_MULTIPLIER) * (1 + state.scouts * SCOUT_BONUS);
      const incubatorBonus = 1 + state.structures.incubator * 0.35;
      const nectarEfficiency = Math.max(0.4, 1 - state.structures.feeding * FEEDING_REDUCTION);
      const assignments = state.productionFrozen ? { leaves: 0, nectar: 0, grit: 0 } : state.assignments;

      const production: Record<ResourceType, number> = {
        leaves: assignments.leaves * BASE_PRODUCTION * productionModifier,
        nectar: assignments.nectar * BASE_PRODUCTION * productionModifier,
        grit: assignments.grit * (BASE_PRODUCTION * 0.75) * productionModifier,
      };

      let nectar = state.resources.nectar + production.nectar;
      const nectarConsumption = state.workers * BASE_NECTAR_USE * nectarEfficiency;
      nectar -= nectarConsumption;

      const leaves = clampResource(state.resources.leaves + production.leaves, state.capacity);
      const grit = clampResource(state.resources.grit + production.grit, state.capacity);
      nectar = clampResource(nectar, state.capacity);

      const defeatCounter = nectar <= 0 ? state.defeatCounter + 1 : 0;
      const productionFrozen =
        defeatCounter >= FREEZE_THRESHOLD ? true : nectar > 5 ? false : state.productionFrozen;

      const queenProgress = state.productionFrozen
        ? state.queenProgress
        : state.queenProgress + incubatorBonus * 0.8;

      let workers = state.workers;
      let freeWorkers = state.freeWorkers;
      let updatedAssignments = { ...state.assignments };
      let log = state.log;
      let explorationPoints = state.explorationPoints;
      let explorationParties = state.explorationParties
        .map((party) => ({ ...party, timer: party.timer - 1 }))
        .filter((party) => party.timer >= 0);

      const returning = explorationParties.filter((party) => party.timer === 0);
      if (returning.length > 0) {
        const returnedWorkers = returning.reduce((sum, party) => sum + party.workers, 0);
        freeWorkers += returnedWorkers;
        explorationPoints += returning.length;
        returning.forEach(() => {
          log = addLog(log, `Разведка вернулась с новостями. Доступно очков разведки: ${explorationPoints}.`);
        });
        explorationParties = explorationParties.filter((party) => party.timer > 0);
      }

      if (queenProgress >= QUEEN_THRESHOLD && !productionFrozen) {
        const newWorker = Math.floor(queenProgress / QUEEN_THRESHOLD);
        workers += newWorker;
        freeWorkers += newWorker;
        const remainder = queenProgress % QUEEN_THRESHOLD;
        log = addLog(log, `Матка вывела ${newWorker} нового рабочего.`);
        return {
          ...state,
          tick: nextTick,
          phase,
          resources: { leaves, nectar, grit },
          defeatCounter,
          productionFrozen,
          queenProgress: remainder,
          workers,
          freeWorkers,
          assignments: updatedAssignments,
          log,
          resourceNodes: updateResourceNodes(state.resourceNodes, assignments),
          explorationPoints,
          explorationParties,
          buildPulseUntil: state.buildPulseUntil > nextTick ? state.buildPulseUntil : 0,
          explorationPulseUntil:
            state.explorationPulseUntil > nextTick ? state.explorationPulseUntil : 0,
        };
      }

      let messageLog = log;
      if (!state.productionFrozen && productionFrozen) {
        messageLog = addLog(
          messageLog,
          'Колония страдает от нехватки нектара. Производство остановлено.'
        );
      }
      if (state.productionFrozen && !productionFrozen) {
        messageLog = addLog(messageLog, 'Склад пополнился нектаром, производство возобновлено.');
      }

      return {
        ...state,
        tick: nextTick,
        phase,
        resources: { leaves, nectar, grit },
        defeatCounter,
        productionFrozen,
        queenProgress,
        assignments: updatedAssignments,
        log: messageLog,
        resourceNodes: updateResourceNodes(state.resourceNodes, assignments),
        explorationPoints,
        explorationParties,
        freeWorkers,
        workers,
        buildPulseUntil: state.buildPulseUntil > nextTick ? state.buildPulseUntil : 0,
        explorationPulseUntil:
          state.explorationPulseUntil > nextTick ? state.explorationPulseUntil : 0,
      };
    }
    default:
      return state;
  }
}

function App() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);
  const [activeMobileTab, setActiveMobileTab] = useState<'buildings' | 'upgrades' | 'priorities'>(
    'buildings'
  );

  useEffect(() => {
    const interval = window.setInterval(() => dispatch({ type: 'tick' }), TICK_INTERVAL);
    return () => window.clearInterval(interval);
  }, []);

  const formattedResources = useMemo(() => formatResources(state.resources), [state.resources]);

  const assignmentsTotal =
    state.assignments.leaves + state.assignments.nectar + state.assignments.grit;
  const exploringWorkers = state.explorationParties.reduce((sum, party) => sum + party.workers, 0);
  const haulingWorkers = Math.min(assignmentsTotal, Math.round(assignmentsTotal * 0.35));
  const gatheringWorkers = Math.max(0, assignmentsTotal - haulingWorkers);

  const canBuild = (structure: Structure) => {
    const costs: Record<Structure, Partial<Record<ResourceType, number>>> = {
      storage: { leaves: 35, grit: 12 },
      feeding: { leaves: 30, nectar: 25 },
      incubator: { leaves: 45, grit: 20 },
    };
    const cost = costs[structure];
    return (Object.entries(cost) as [ResourceType, number | undefined][]).every(([resource, amount]) => {
      return state.resources[resource] >= (amount ?? 0);
    });
  };

  const canAdvance =
    state.colonyLevel < 10 &&
    state.resources.leaves >= 60 + state.colonyLevel * 20 &&
    state.resources.nectar >= 35 + state.colonyLevel * 10 &&
    state.resources.grit >= Math.max(10, 15 + state.colonyLevel * 5);

  const canPromoteScout = state.workers > 0 && state.resources.nectar >= 40;
  const cycleTick = state.tick % DAY_LENGTH;
  const phaseProgress = cycleTick / DAY_LENGTH;
  const nectarFill = Math.min(1, state.resources.nectar / state.capacity);

  return (
    <div className="app">
      <header className="top-bar">
        <div className="top-bar__column">
          <h1 className="top-bar__title">Муравьиная колония MVP</h1>
          <p className="top-bar__subtitle">
            Управляйте потоком ресурсов и расширяйте гнездо, чтобы достичь 10 уровня.
          </p>
        </div>
        <div className="top-bar__status">
          <div className="resource-chip">
            <span className="resource-chip__label">Листья</span>
            <strong>{formattedResources.leaves}</strong>
            <span className="resource-chip__cap">/{state.capacity}</span>
          </div>
          <div className="resource-chip">
            <span className="resource-chip__label">Нектар</span>
            <strong>{formattedResources.nectar}</strong>
            <span className="resource-chip__cap">/{state.capacity}</span>
          </div>
          <div className="resource-chip">
            <span className="resource-chip__label">Материалы</span>
            <strong>{formattedResources.grit}</strong>
            <span className="resource-chip__cap">/{state.capacity}</span>
          </div>
          <div className="meter">
            <span className="meter__label">Энергия колонии</span>
            <div className="meter__track">
              <div className="meter__fill" style={{ width: `${nectarFill * 100}%` }} />
            </div>
          </div>
          <div className={`phase-indicator phase-indicator--${state.phase}`}>
            <span>{state.phase === 'day' ? 'День' : 'Ночь'}</span>
            <div className="phase-indicator__progress">
              <div style={{ width: `${phaseProgress * 100}%` }} />
            </div>
          </div>
          <div className="colony-level">
            <span>Уровень</span>
            <strong>{state.colonyLevel}</strong>
          </div>
        </div>
      </header>

      <main className="game-layout">
        <section className="map" aria-label="Карта муравейника">
          <div className={`nest ${state.buildPulseUntil > state.tick ? 'nest--building' : ''}`}>
            <div className="nest__core">
              <span className="nest__label">Гнездо</span>
              <span className="nest__lvl">Ур. {state.colonyLevel}</span>
            </div>
            <div className="nest__rings" />
          </div>
          <svg className="map__routes" viewBox="0 0 100 100" preserveAspectRatio="none">
            {state.resourceNodes
              .filter((node) => node.status !== 'locked')
              .map((node) => {
                const thickness = 1 + node.traffic * 4;
                return (
                  <line
                    key={`route-${node.id}`}
                    x1={50}
                    y1={50}
                    x2={node.x}
                    y2={node.y}
                    strokeWidth={thickness}
                    className={`map__route map__route--${node.type}`}
                  />
                );
              })}
          </svg>
          <div className="map__nodes">
            {state.resourceNodes.map((node) => (
              <button
                key={node.id}
                className={`map-node map-node--${node.type} map-node--${node.status}`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onClick={() => dispatch({ type: 'revealNode', id: node.id })}
                disabled={node.status !== 'locked'}
              >
                <span className="map-node__icon">{node.status === 'locked' ? '?' : node.label[0]}</span>
                <span className="map-node__label">{node.label}</span>
                {node.status !== 'locked' && (
                  <span className="map-node__traffic" style={{ opacity: 0.2 + node.traffic * 0.8 }}>
                    Трафик {Math.round(node.traffic * 100)}%
                  </span>
                )}
                <span className="map-node__tooltip">
                  {node.description}
                  <br />
                  Богатство: ×{node.richness.toFixed(1)}
                  {node.status === 'locked' && (
                    <>
                      <br />
                      Требуется очко разведки
                    </>
                  )}
                </span>
              </button>
            ))}
          </div>
          {state.explorationPulseUntil > state.tick && <div className="map__pulse" />}
        </section>

        <aside className="side-panel" data-active-tab={activeMobileTab}>
          <div className="side-panel__tabs" role="tablist">
            <button
              className={activeMobileTab === 'buildings' ? 'is-active' : ''}
              onClick={() => setActiveMobileTab('buildings')}
              role="tab"
              aria-selected={activeMobileTab === 'buildings'}
            >
              Постройки
            </button>
            <button
              className={activeMobileTab === 'upgrades' ? 'is-active' : ''}
              onClick={() => setActiveMobileTab('upgrades')}
              role="tab"
              aria-selected={activeMobileTab === 'upgrades'}
            >
              Улучшения
            </button>
            <button
              className={activeMobileTab === 'priorities' ? 'is-active' : ''}
              onClick={() => setActiveMobileTab('priorities')}
              role="tab"
              aria-selected={activeMobileTab === 'priorities'}
            >
              Приоритеты
            </button>
          </div>
          <div className="side-panel__section" data-tab="buildings">
            <h2>Постройки</h2>
            <div className="card-list">
              <article className="card">
                <header className="card__header">
                  <h3>Склад</h3>
                  <span className="card__effect">+{STORAGE_BONUS} к ёмкости</span>
                </header>
                <p>Вмещает больше ресурсов, окупаемость ~4 мин.</p>
                <footer className="card__footer">
                  <span className="card__cost">35 листьев · 12 песка</span>
                  <button
                    onClick={() => dispatch({ type: 'build', structure: 'storage' })}
                    disabled={!canBuild('storage') || state.structures.storage >= 3}
                  >
                    Построить (ур. {state.structures.storage})
                  </button>
                </footer>
              </article>

              <article className="card">
                <header className="card__header">
                  <h3>Кормовая</h3>
                  <span className="card__effect">-12% потребление</span>
                </header>
                <p>Сокращает расход нектара рабочими, окупаемость ~3 мин.</p>
                <footer className="card__footer">
                  <span className="card__cost">30 листьев · 25 нектара</span>
                  <button
                    onClick={() => dispatch({ type: 'build', structure: 'feeding' })}
                    disabled={!canBuild('feeding') || state.structures.feeding >= 3}
                  >
                    Улучшить (ур. {state.structures.feeding})
                  </button>
                </footer>
              </article>

              <article className="card">
                <header className="card__header">
                  <h3>Инкубатор</h3>
                  <span className="card__effect">+35% рост</span>
                </header>
                <p>Ускоряет вывод новых рабочих. Окупаемость ~5 мин.</p>
                <footer className="card__footer">
                  <span className="card__cost">45 листьев · 20 песка</span>
                  <button
                    onClick={() => dispatch({ type: 'build', structure: 'incubator' })}
                    disabled={!canBuild('incubator') || state.structures.incubator >= 3}
                  >
                    Улучшить (ур. {state.structures.incubator})
                  </button>
                </footer>
              </article>
            </div>
          </div>

          <div className="side-panel__section" data-tab="upgrades">
            <h2>Улучшения</h2>
            <ul className="upgrade-list">
              <li className={state.structures.storage > 0 ? 'upgrade-list__item upgrade-list__item--done' : 'upgrade-list__item'}>
                <span>Быстрый склад — +15% к скорости заноса ресурсов.</span>
              </li>
              <li className={state.structures.feeding > 0 ? 'upgrade-list__item upgrade-list__item--done' : 'upgrade-list__item'}>
                <span>Ароматные тропы — рабочие дольше не голодают.</span>
              </li>
              <li className={state.structures.incubator > 0 ? 'upgrade-list__item upgrade-list__item--done' : 'upgrade-list__item'}>
                <span>Тёплые камеры — матка выводит личинок быстрее.</span>
              </li>
              <li className={state.scouts > 0 ? 'upgrade-list__item upgrade-list__item--done' : 'upgrade-list__item'}>
                <span>Разведка окраины — +{(state.scouts * SCOUT_BONUS * 100).toFixed(0)}% к добыче.</span>
              </li>
              <li className={state.colonyLevel >= 4 ? 'upgrade-list__item upgrade-list__item--done' : 'upgrade-list__item'}>
                <span>Купол безопасности — новые маршруты защищены.</span>
              </li>
              <li className={state.colonyLevel >= 7 ? 'upgrade-list__item upgrade-list__item--done' : 'upgrade-list__item'}>
                <span>Подземные склады — стабильная доставка ресурсов.</span>
              </li>
            </ul>
            <button className="cta" onClick={() => dispatch({ type: 'advanceColony' })} disabled={!canAdvance}>
              Повысить уровень колонии
            </button>
          </div>

          <div className="side-panel__section" data-tab="priorities">
            <h2>Задачи и приоритеты</h2>
            <div className="priorities">
              <div className="priorities__row">
                <span>Листья</span>
                <div className="priorities__controls">
                  <button
                    onClick={() => dispatch({ type: 'assign', resource: 'leaves' })}
                    disabled={state.freeWorkers <= 0 || state.productionFrozen}
                  >
                    ↑
                  </button>
                  <span>{state.assignments.leaves}</span>
                  <button
                    onClick={() => dispatch({ type: 'recall', resource: 'leaves' })}
                    disabled={state.assignments.leaves <= 0}
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className="priorities__row">
                <span>Нектар</span>
                <div className="priorities__controls">
                  <button
                    onClick={() => dispatch({ type: 'assign', resource: 'nectar' })}
                    disabled={state.freeWorkers <= 0 || state.productionFrozen}
                  >
                    ↑
                  </button>
                  <span>{state.assignments.nectar}</span>
                  <button
                    onClick={() => dispatch({ type: 'recall', resource: 'nectar' })}
                    disabled={state.assignments.nectar <= 0}
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className="priorities__row">
                <span>Материалы</span>
                <div className="priorities__controls">
                  <button
                    onClick={() => dispatch({ type: 'assign', resource: 'grit' })}
                    disabled={state.freeWorkers <= 0 || state.productionFrozen}
                  >
                    ↑
                  </button>
                  <span>{state.assignments.grit}</span>
                  <button
                    onClick={() => dispatch({ type: 'recall', resource: 'grit' })}
                    disabled={state.assignments.grit <= 0}
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div className="priorities__presets">
                <button onClick={() => dispatch({ type: 'preset', preset: 'balanced' })}>Баланс</button>
                <button onClick={() => dispatch({ type: 'preset', preset: 'food' })}>Еда сначала</button>
                <button onClick={() => dispatch({ type: 'preset', preset: 'build' })}>Стройка сначала</button>
              </div>
            </div>
            <div className="actions__row">
              <button onClick={() => dispatch({ type: 'explore' })} disabled={state.freeWorkers <= 0}>
                Разведка ({state.explorationParties.length > 0 ? 'в пути' : 'готово'})
              </button>
              <button onClick={() => dispatch({ type: 'promoteScout' })} disabled={!canPromoteScout}>
                Повысить разведчика
              </button>
            </div>
            <p className="exploration-info">
              Очки разведки: {state.explorationPoints} · Разведчики: {state.scouts}
            </p>
          </div>
        </aside>
      </main>

      <footer className="status-bar">
        <div className="status-bar__workers">
          <strong>Рабочие: {state.workers}</strong>
          <span>
            {`Добывают: ${gatheringWorkers} · Несут: ${haulingWorkers} · Разведка: ${exploringWorkers} · Свободны: ${state.freeWorkers}`}
          </span>
        </div>
        <div className="status-bar__log">
          <h2>События</h2>
          <ul>
            {state.log.map((entry, index) => (
              <li key={index}>{entry}</li>
            ))}
          </ul>
        </div>
        {state.productionFrozen && (
          <div className="status-bar__warning">
            Производство заморожено из-за нехватки нектара. Пополните склады, чтобы вернуться к работе.
          </div>
        )}
        {state.victory && (
          <div className="victory" role="alert">
            <h2>Победа!</h2>
            <p>Вы достигли 10 уровня и доказали устойчивость колонии.</p>
            <button onClick={() => dispatch({ type: 'acknowledgeVictory' })}>Продолжить симуляцию</button>
          </div>
        )}
      </footer>
    </div>
  );
}

export default App;
