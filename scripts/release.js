import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import semver from 'semver';
import enquirer from 'enquirer';
const { Select } = enquirer;

async function bump() {
    const trackedFiles = [
        'package.json',
        'src-tauri/tauri.conf.json',
        'src-tauri/Cargo.toml'
    ];
    const originalContents = new Map();

    try {
        const packageJsonPath = path.resolve(process.cwd(), 'package.json');
        const tauriConfPath = path.resolve(process.cwd(), 'src-tauri/tauri.conf.json');
        const cargoTomlPath = path.resolve(process.cwd(), 'src-tauri/Cargo.toml');
        const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
        const dirtyFiles = execSync(`git status --porcelain -- ${trackedFiles.join(' ')}`, { encoding: 'utf-8' }).trim();

        if (dirtyFiles) {
            throw new Error(
                'Version files already have local changes. Please commit or stash package.json, src-tauri/tauri.conf.json, and src-tauri/Cargo.toml before running the release script.'
            );
        }

        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const currentVersion = packageJson.version;
        originalContents.set(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        originalContents.set(tauriConfPath, fs.readFileSync(tauriConfPath, 'utf-8'));
        originalContents.set(cargoTomlPath, fs.readFileSync(cargoTomlPath, 'utf-8'));

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
        execSync(`git add ${trackedFiles.join(' ')}`, { stdio: 'inherit' });
        execSync(`git commit -m "chore: bump version to v${newVersion}"`, { stdio: 'inherit' });

        console.log(`\n🎉 Success! Version bumped locally.`);
        console.log(`Next steps:`);
        if (currentBranch === 'master') {
            console.log(`1. git push origin master`);
            console.log(`2. The push to 'master' will trigger the automated release workflow.`);
        } else {
            console.log(`1. git push origin ${currentBranch}`);
            console.log(`2. Open a PR from '${currentBranch}' to 'master'.`);
            console.log(`3. Merge the PR to trigger the automated release workflow.`);
        }

    } catch (error) {
        console.error('\n❌ Release failed:', error.message);
        if (originalContents.size > 0) {
            console.log('Restoring version files...');
            for (const [filePath, content] of originalContents.entries()) {
                fs.writeFileSync(filePath, content);
            }
            console.log('✅ Version files restored.');
        }
        process.exit(1);
    }
}

bump();
