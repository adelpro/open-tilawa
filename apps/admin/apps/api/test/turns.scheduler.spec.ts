import { Logger } from '@nestjs/common';
import { TurnsScheduler } from '../src/turns/turns.scheduler';

/**
 * The cron's own contract: it calls the probe pass, and a failing pass is
 * logged rather than thrown — an unhandled rejection in a scheduled task is how
 * a transient TURN outage turns into a crash loop.
 */
describe('TurnsScheduler', () => {
  it('runs one probe pass', async () => {
    const runChecks = jest.fn().mockResolvedValue([]);
    const scheduler = new TurnsScheduler({ runChecks } as never);
    await scheduler.probe();
    expect(runChecks).toHaveBeenCalledTimes(1);
  });

  it('logs and swallows a failed pass', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const runChecks = jest.fn().mockRejectedValue(new Error('boom'));
    const scheduler = new TurnsScheduler({ runChecks } as never);
    await expect(scheduler.probe()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
    warn.mockRestore();
  });
});
