import AppDataSource from './data-source';

type MigrateCommand = 'up' | 'down' | 'revert' | 'status';

async function run() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const command = (process.argv[2] ?? 'up') as MigrateCommand;

  await AppDataSource.initialize();
  try {
    switch (command) {
      case 'up': {
        const executed = await AppDataSource.runMigrations({
          transaction: 'each',
        });
        console.log(
          executed.length
            ? `Applied ${executed.length} migration(s): ${executed.map((m) => m.name).join(', ')}`
            : 'No pending migrations to apply.',
        );
        break;
      }
      case 'down':
      case 'revert': {
        await AppDataSource.undoLastMigration({ transaction: 'each' });
        console.log('Reverted last migration successfully.');
        break;
      }
      case 'status': {
        const hasPending = await AppDataSource.showMigrations();
        process.exitCode = hasPending ? 1 : 0;
        break;
      }
      default:
        throw new Error(
          `Unknown migration command "${String(command)}". Use: up | down | status`,
        );
    }
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
