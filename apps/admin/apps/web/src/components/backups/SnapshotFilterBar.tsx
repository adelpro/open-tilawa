import type { ReactElement } from 'react';

import { useI18n } from '../../lib/i18n';
import type { SnapshotSort } from '../../lib/snapshot-filters';
import { Input } from '../Field';

export type SnapshotFilterState = {
  query: string;
  sort: SnapshotSort;
  olderThanDays: number | null;
};

export function SnapshotFilterBar({
  value,
  onChange,
}: {
  value: SnapshotFilterState;
  onChange: (next: SnapshotFilterState) => void;
}): ReactElement {
  const { t } = useI18n();
  return (
    <div className="cluster" role="group" aria-label={t('backups.filter')}>
      <Input
        aria-label={t('backups.filterPlaceholder')}
        placeholder={t('backups.filterPlaceholder')}
        value={value.query}
        onChange={(event) => onChange({ ...value, query: event.target.value })}
      />
      <select
        className="field__select"
        aria-label={t('backups.sort')}
        value={value.sort}
        onChange={(event) =>
          onChange({ ...value, sort: event.target.value as SnapshotSort })
        }
      >
        <option value="newest">{t('backups.sortNewest')}</option>
        <option value="oldest">{t('backups.sortOldest')}</option>
        <option value="largest">{t('backups.sortLargest')}</option>
        <option value="smallest">{t('backups.sortSmallest')}</option>
        <option value="name">{t('backups.sortName')}</option>
      </select>
      <select
        className="field__select"
        aria-label={t('backups.age')}
        value={value.olderThanDays === null ? 'all' : String(value.olderThanDays)}
        onChange={(event) =>
          onChange({
            ...value,
            olderThanDays: event.target.value === 'all' ? null : Number(event.target.value),
          })
        }
      >
        <option value="all">{t('backups.ageAll')}</option>
        <option value="7">{t('backups.age7')}</option>
        <option value="30">{t('backups.age30')}</option>
      </select>
    </div>
  );
}
