import { useEffect, useMemo, useReducer } from 'react';
import './App.css';

type ResourceType = 'leaves' | 'nectar' | 'grit';

type GamePhase = 'day' | 'night';

type Structure = 'storage' | 'feeding' | 'incubator';

type GameAction =
  | { type: 'tick' }
  | { type: 'assign'; resource: ResourceType }
  | { type: 'recall'; resource: ResourceType }
  | { type: 'build'; structure: Structure }
  | { type: 'promoteScout' }
  | { type: 'advanceColony' }
  | { type: 'acknowledgeVictory' };

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

const INITIAL_STATE: GameState = {
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
    'Назначьте рабочих и постройте ключевые камеры, чтобы достичь 10 уровня.'
  ],
};

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

function addLog(state: GameState, entry: string): string[] {
  return [entry, ...state.log].slice(0, 8);
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
      const newState: GameState = {
        ...state,
        resources: updatedResources,
        structures: {
          ...state.structures,
          [action.structure]: structureLevel + 1,
        },
        capacity,
        log: addLog(
          state,
          `Построена ${structureName(action.structure)} (уровень ${structureLevel + 1}).`
        ),
      };
      return newState;
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
          log: addLog(state, 'Один из рабочих стал разведчиком и расширил границы обзора.'),
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
        log: addLog(state, 'Один из рабочих стал разведчиком и расширил границы обзора.'),
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
      const newState: GameState = {
        ...state,
        resources: updatedResources,
        colonyLevel: nextLevel,
        colonyProgress: 0,
        victory,
        log: addLog(
          state,
          victory
            ? 'Колония достигла легендарного 10 уровня! Муравейник признан процветающим.'
            : `Колония усилилась и достигла ${nextLevel} уровня.`
        ),
      };
      return newState;
    }
    case 'acknowledgeVictory': {
      return {
        ...state,
        victory: false,
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
      const productionFrozen = defeatCounter >= FREEZE_THRESHOLD ? true : nectar > 5 ? false : state.productionFrozen;

      const queenProgress = state.productionFrozen
        ? state.queenProgress
        : state.queenProgress + incubatorBonus * 0.8;
      let workers = state.workers;
      let freeWorkers = state.freeWorkers;
      let updatedAssignments = { ...state.assignments };
      let log = state.log;

      if (queenProgress >= QUEEN_THRESHOLD && !productionFrozen) {
        const newWorker = Math.floor(queenProgress / QUEEN_THRESHOLD);
        workers += newWorker;
        freeWorkers += newWorker;
        const remainder = queenProgress % QUEEN_THRESHOLD;
        log = addLog(state, `Матка вывела ${newWorker} нового рабочего.`);
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
        };
      }

      let messageLog = log;
      if (!state.productionFrozen && productionFrozen) {
        messageLog = addLog(state, 'Колония страдает от нехватки нектара. Производство остановлено.');
      }
      if (state.productionFrozen && !productionFrozen) {
        messageLog = addLog(state, 'Склад пополнился нектаром, производство возобновлено.');
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
      };
    }
    default:
      return state;
  }
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

function App() {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  useEffect(() => {
    const interval = window.setInterval(() => dispatch({ type: 'tick' }), TICK_INTERVAL);
    return () => window.clearInterval(interval);
  }, []);

  const formattedResources = useMemo(() => formatResources(state.resources), [state.resources]);

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

  const canAdvance = state.colonyLevel < 10 &&
    state.resources.leaves >= 60 + state.colonyLevel * 20 &&
    state.resources.nectar >= 35 + state.colonyLevel * 10 &&
    state.resources.grit >= Math.max(10, 15 + state.colonyLevel * 5);

  const canPromoteScout = state.workers > 0 && state.resources.nectar >= 40;

  return (
    <div className="app">
      <header className="app__header">
        <h1>Муравьиная колония MVP</h1>
        <p>
          Поддерживайте производство, развивайте ключевые камеры и достигните 10 уровня, чтобы
          доказать жизнеспособность муравейника.
        </p>
      </header>

      <section className="summary">
        <div className="summary__item">
          <span className="summary__label">Уровень колонии:</span>
          <span className="summary__value">{state.colonyLevel}</span>
        </div>
        <div className={`summary__item summary__item--${state.phase}`}>
          <span className="summary__label">Фаза:</span>
          <span className="summary__value">{state.phase === 'day' ? 'День' : 'Ночь'}</span>
        </div>
        <div className="summary__item">
          <span className="summary__label">Рабочие:</span>
          <span className="summary__value">
            {state.freeWorkers}/{state.workers}
          </span>
        </div>
        <div className="summary__item">
          <span className="summary__label">Разведчики:</span>
          <span className="summary__value">{state.scouts}</span>
        </div>
        <div className="summary__item">
          <span className="summary__label">Емкость склада:</span>
          <span className="summary__value">{state.capacity}</span>
        </div>
      </section>

      <section className="resources">
        <h2>Ресурсы</h2>
        <div className="resources__grid">
          <article className="resource-card">
            <h3>Листья</h3>
            <p className="resource-card__value">{formattedResources.leaves}</p>
            <div className="resource-card__controls">
              <button onClick={() => dispatch({ type: 'assign', resource: 'leaves' })} disabled={state.freeWorkers <= 0 || state.productionFrozen}>
                + Рабочий
              </button>
              <button onClick={() => dispatch({ type: 'recall', resource: 'leaves' })} disabled={state.assignments.leaves <= 0}>
                – Рабочий
              </button>
              <span>{state.assignments.leaves} назначено</span>
            </div>
          </article>

          <article className="resource-card">
            <h3>Нектар</h3>
            <p className="resource-card__value">{formattedResources.nectar}</p>
            <div className="resource-card__controls">
              <button onClick={() => dispatch({ type: 'assign', resource: 'nectar' })} disabled={state.freeWorkers <= 0 || state.productionFrozen}>
                + Рабочий
              </button>
              <button onClick={() => dispatch({ type: 'recall', resource: 'nectar' })} disabled={state.assignments.nectar <= 0}>
                – Рабочий
              </button>
              <span>{state.assignments.nectar} назначено</span>
            </div>
          </article>

          <article className="resource-card">
            <h3>Песок и палочки</h3>
            <p className="resource-card__value">{formattedResources.grit}</p>
            <div className="resource-card__controls">
              <button onClick={() => dispatch({ type: 'assign', resource: 'grit' })} disabled={state.freeWorkers <= 0 || state.productionFrozen}>
                + Рабочий
              </button>
              <button onClick={() => dispatch({ type: 'recall', resource: 'grit' })} disabled={state.assignments.grit <= 0}>
                – Рабочий
              </button>
              <span>{state.assignments.grit} назначено</span>
            </div>
          </article>
        </div>
      </section>

      <section className="actions">
        <h2>Постройки и улучшения</h2>
        <div className="actions__grid">
          <article className="action-card">
            <h3>Склад</h3>
            <p>Увеличивает лимит хранения ресурсов на {STORAGE_BONUS} за уровень.</p>
            <p>Стоимость: 35 листьев, 12 песка.</p>
            <button onClick={() => dispatch({ type: 'build', structure: 'storage' })} disabled={!canBuild('storage') || state.structures.storage >= 3}>
              Построить (ур. {state.structures.storage})
            </button>
          </article>

          <article className="action-card">
            <h3>Кормовая камера</h3>
            <p>Снижает потребление нектара рабочими.</p>
            <p>Стоимость: 30 листьев, 25 нектара.</p>
            <button onClick={() => dispatch({ type: 'build', structure: 'feeding' })} disabled={!canBuild('feeding') || state.structures.feeding >= 3}>
              Улучшить (ур. {state.structures.feeding})
            </button>
          </article>

          <article className="action-card">
            <h3>Инкубатор</h3>
            <p>Ускоряет вывод новых рабочих.</p>
            <p>Стоимость: 45 листьев, 20 песка.</p>
            <button onClick={() => dispatch({ type: 'build', structure: 'incubator' })} disabled={!canBuild('incubator') || state.structures.incubator >= 3}>
              Улучшить (ур. {state.structures.incubator})
            </button>
          </article>

          <article className="action-card">
            <h3>Повысить уровень колонии</h3>
            <p>Продвиньтесь к победе, инвестируя ресурсы в развитие гнезда.</p>
            <p>
              Стоимость следующего уровня: {60 + state.colonyLevel * 20} листьев, {35 + state.colonyLevel * 10}{' '}
              нектара, {Math.max(10, 15 + state.colonyLevel * 5)} песка.
            </p>
            <button onClick={() => dispatch({ type: 'advanceColony' })} disabled={!canAdvance}>
              Улучшить
            </button>
          </article>

          <article className="action-card">
            <h3>Повысить разведчика</h3>
            <p>Разведчики раскрывают новые узлы ресурсов и дают бонус добычи.</p>
            <p>Стоимость: 40 нектара и один рабочий.</p>
            <button onClick={() => dispatch({ type: 'promoteScout' })} disabled={!canPromoteScout}>
              Повысить разведчика
            </button>
          </article>
        </div>
      </section>

      <section className="log">
        <h2>Журнал событий</h2>
        <ul>
          {state.log.map((entry, index) => (
            <li key={index}>{entry}</li>
          ))}
        </ul>
      </section>

      {state.productionFrozen && (
        <div className="warning">
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
    </div>
  );
}

export default App;
