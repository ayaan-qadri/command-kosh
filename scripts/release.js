import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import semver from 'semver';
import { Select } from 'enquirer';

async function bump() {
    try {
        const packageJsonPath = path.resolve(process.cwd(), 'package.json');
        const tauriConfPath = path.resolve(process.cwd(), 'src-tauri/tauri.conf.json');
        const cargoTomlPath = path.resolve(process.cwd(), 'src-tauri/Cargo.toml');

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const currentVersion = packageJson.version;

        console.log(`Current version: ${currentVersion}`);

        const prompt = new Select({
            name: 'type',
            message: 'Select bump type:',
            choices: ['patch', 'minor', 'major']
        });

        const type = await prompt.run();
        const newVersion = semver.inc(currentVersion, type);

        console.log(`Bumping to: ${newVersion}...`);

        // 1. Update package.json
        packageJson.version = newVersion;
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

        // 2. Update tauri.conf.json
        const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
        tauriConf.version = newVersion;
        fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n');

        // 3. Update Cargo.toml
        let cargoToml = fs.readFileSync(cargoTomlPath, 'utf-8');
        cargoToml = cargoToml.replace(/^version = ".*"/m, `version = "${newVersion}"`);
        fs.writeFileSync(cargoTomlPath, cargoToml);

        console.log('✅ Version files updated.');

        // 4. Git operations
        console.log('Committing changes...');
        execSync(`git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml`);
        execSync(`git commit -m "chore: bump version to v${newVersion}"`);

        console.log(`\n🎉 Success! Version bumped locally.`);
        console.log(`Next steps:`);
        console.log(`1. git push origin main`);
        console.log(`2. Create a PR from 'main' to 'master' on GitHub.`);
        console.log(`3. Merge the PR to trigger the automated release build.`);

    } catch (error) {
        console.error('\n❌ Release failed:', error.message);
        console.log('Attempting to rollback changes...');
        try {
            // Revert any changes to the version files
            execSync('git checkout -- package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml', { stdio: 'ignore' });
            console.log('✅ Changes to version files reverted.');

            // If we already staged files, unstage them
            execSync('git reset HEAD package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml', { stdio: 'ignore' });
        } catch (rollbackError) {
            console.warn('⚠️ Manual cleanup might be required. Run "git status" to check.');
        }
        process.exit(1);
    }
}

bump();
