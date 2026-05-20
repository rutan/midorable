import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react';
import { ParticleEmitterConfig, ParticleForce, ParticleSpawnConfig } from '@rutan/midorable';
import { useImage, useParticleEmitterConfig } from '../hooks';
import { cx } from '../utils';
import { SettingsTab } from './SettingsTab';
import { TextureTab } from './TextureTab';

export const ParameterEditor = () => {
  const { config, setConfig } = useParticleEmitterConfig();
  const { imageUrl, imageFrames, setImageFromFile, setTextureFromFile, clearImage } = useImage();

  const updateConfig = (update: (previous: ParticleEmitterConfig) => ParticleEmitterConfig) => {
    setConfig((previous) => update(previous));
  };

  const updateSpawn = (update: (previous: ParticleSpawnConfig) => ParticleSpawnConfig) => {
    updateConfig((previous) => ({ ...previous, spawn: update(previous.spawn) }));
  };

  const updateForces = (update: (previous: ParticleForce[]) => ParticleForce[]) => {
    updateConfig((previous) => ({ ...previous, forces: update(previous.forces) }));
  };

  return (
    <div className={cx('ParameterEditor', 'box-border min-h-0 h-full w-full bg-slate-200 p-2')}>
      <TabGroup className="flex h-full flex-col gap-2">
        <TabList className="flex rounded-lg bg-slate-300 p-1 gap-1">
          <Tab className={tabClassName}>設定</Tab>
          <Tab className={tabClassName}>テクスチャ</Tab>
        </TabList>
        <TabPanels className="min-h-0 flex-1 overflow-auto rounded-lg bg-slate-100 p-3">
          <TabPanel>
            <SettingsTab
              config={config}
              updateConfig={updateConfig}
              updateSpawn={updateSpawn}
              updateForces={updateForces}
            />
          </TabPanel>
          <TabPanel>
            <TextureTab
              imageUrl={imageUrl}
              imageFrames={imageFrames}
              onSelectFile={setImageFromFile}
              onApplyTexturePack={setTextureFromFile}
              onClear={clearImage}
            />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
};

export function tabClassName({ selected }: { selected: boolean }) {
  return cx(
    'flex-1 rounded-md px-3 py-1 text-sm',
    selected ? 'bg-slate-50 font-semibold text-slate-900' : 'text-slate-700 hover:bg-slate-200 cursor-pointer',
  );
}
