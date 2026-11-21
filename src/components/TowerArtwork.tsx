import type { EnemyType, TowerType } from '../game/types';

export function TowerIconSVG({type, className}: {type: TowerType; className?: string}) {
  return <img alt="" className={className} src={import.meta.env.BASE_URL + 'assets/citadel/tower_' + type + '_l1.webp'} />;
}
export function EnemyIconSVG({type, className}: {type: EnemyType; className?: string}) {
  return <img alt="" className={className} src={import.meta.env.BASE_URL + 'assets/citadel/enemy_' + type + '.webp'} />;
}
