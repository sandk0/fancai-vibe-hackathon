/**
 * ReaderSettingsPanel - Modern settings panel for reading experience
 *
 * Features:
 * - Bottom sheet on mobile with drag-to-dismiss
 * - Side panel on desktop
 * - Backdrop blur and dimming
 * - Grouped settings (Theme, Typography, Layout)
 * - Touch-friendly controls (44px minimum)
 * - Framer Motion animations
 *
 * @component
 */

import React, { useCallback, useEffect, useState } from 'react';
import { m, AnimatePresence, PanInfo, useDragControls } from 'framer-motion';
import { X, Type, Sun, Moon, Maximize2, RotateCcw, Minus, Plus, GripHorizontal } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { ReaderTheme } from '@/stores/reader';

interface ReaderSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  theme: ReaderTheme;
  maxWidth: number;
  margin: number;
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
  onLineHeightChange: (height: number) => void;
  onThemeChange: (theme: ReaderTheme) => void;
  onMaxWidthChange: (width: number) => void;
  onMarginChange: (margin: number) => void;
  onReset?: () => void;
}

// Theme configurations with visual preview
const themeConfigs: Record<ReaderTheme, { bg: string; text: string; label: string; icon: typeof Sun }> = {
  light: { bg: '#FFFFFF', text: '#1A1A1A', label: 'Light', icon: Sun },
  dark: { bg: '#121212', text: '#E0E0E0', label: 'Dark', icon: Moon },
  sepia: { bg: '#FBF0D9', text: '#3D2914', label: 'Sepia', icon: Sun },
  night: { bg: '#000000', text: '#B0B0B0', label: 'Night', icon: Moon },
};

// Font family options
const fontFamilyOptions = [
  { value: 'Georgia, serif', label: 'Serif', preview: 'Aa' },
  { value: '"Inter", sans-serif', label: 'Sans', preview: 'Aa' },
  { value: '"Fira Code", monospace', label: 'Mono', preview: 'Aa' },
];

// Width presets
const widthPresets = [
  { value: 600, label: 'Narrow' },
  { value: 800, label: 'Medium' },
  { value: 1000, label: 'Wide' },
];

// Custom hook for detecting mobile
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

// Section Header component
const SectionHeader: React.FC<{ icon: React.ReactNode; title: string }> = ({ icon, title }) => (
  <div className="flex items-center gap-2 mb-4">
    <span className="text-accent">{icon}</span>
    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">{title}</h3>
  </div>
);

// Slider with value display
interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

const SliderControl: React.FC<SliderControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
  formatValue,
}) => {
  const displayValue = formatValue ? formatValue(value) : `${value}${unit}`;
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-muted-foreground">{label}</label>
        <span className="text-sm font-semibold text-foreground tabular-nums">{displayValue}</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-2 appearance-none cursor-pointer rounded-full bg-secondary
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                     [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary
                     [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background
                     [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110
                     [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                     [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary
                     [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background
                     [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${percentage}%, hsl(var(--secondary)) ${percentage}%, hsl(var(--secondary)) 100%)`,
          }}
          aria-label={label}
        />
      </div>
    </div>
  );
};

// Stepper control for font size
interface StepperControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

const StepperControl: React.FC<StepperControlProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}) => {
  const decrease = () => onChange(Math.max(min, value - step));
  const increase = () => onChange(Math.min(max, value + step));

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground block">{label}</label>
      <div className="flex items-center justify-between bg-secondary/50 rounded-xl p-1">
        <button
          onClick={decrease}
          disabled={value <= min}
          className="flex items-center justify-center w-11 h-11 rounded-lg
                     bg-background text-foreground
                     hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors touch-target"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="w-5 h-5" />
        </button>
        <span className="text-lg font-semibold text-foreground tabular-nums min-w-[4rem] text-center">
          {value}{unit}
        </span>
        <button
          onClick={increase}
          disabled={value >= max}
          className="flex items-center justify-center w-11 h-11 rounded-lg
                     bg-background text-foreground
                     hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed
                     transition-colors touch-target"
          aria-label={`Increase ${label}`}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// Theme button component
interface ThemeButtonProps {
  theme: ReaderTheme;
  isActive: boolean;
  onClick: () => void;
}

const ThemeButton: React.FC<ThemeButtonProps> = ({ theme, isActive, onClick }) => {
  const config = themeConfigs[theme];

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-3 rounded-xl
                  border-2 transition-all touch-target min-h-[72px]
                  ${isActive
                    ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                    : 'border-border bg-card hover:border-muted-foreground/30'
                  }`}
      aria-label={`${config.label} theme`}
      aria-pressed={isActive}
    >
      {/* Theme preview circle */}
      <div
        className="w-8 h-8 rounded-full border-2 border-border mb-1 flex items-center justify-center shadow-sm"
        style={{ backgroundColor: config.bg }}
      >
        <span style={{ color: config.text }} className="text-xs font-bold">
          Aa
        </span>
      </div>
      <span className="text-xs font-medium text-foreground">{config.label}</span>
      {isActive && (
        <m.div
          layoutId="activeTheme"
          className="absolute inset-0 rounded-xl border-2 border-primary"
          initial={false}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}
    </button>
  );
};

// Font family button
interface FontFamilyButtonProps {
  family: typeof fontFamilyOptions[0];
  isActive: boolean;
  onClick: () => void;
}

const FontFamilyButton: React.FC<FontFamilyButtonProps> = ({ family, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center p-3 rounded-xl
                border-2 transition-all touch-target min-h-[72px]
                ${isActive
                  ? 'border-primary bg-primary/10'
                  : 'border-border bg-card hover:border-muted-foreground/30'
                }`}
    aria-label={`${family.label} font`}
    aria-pressed={isActive}
  >
    <span
      className="text-2xl font-normal mb-1"
      style={{ fontFamily: family.value }}
    >
      {family.preview}
    </span>
    <span className="text-xs font-medium text-foreground">{family.label}</span>
  </button>
);

// Width preset button
interface WidthPresetButtonProps {
  preset: typeof widthPresets[0];
  isActive: boolean;
  onClick: () => void;
}

const WidthPresetButton: React.FC<WidthPresetButtonProps> = ({ preset, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all touch-target
                text-sm font-medium
                ${isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:border-muted-foreground/30 text-foreground'
                }`}
    aria-label={`${preset.label} width`}
    aria-pressed={isActive}
  >
    {preset.label}
  </button>
);

// Main component
export const ReaderSettingsPanel: React.FC<ReaderSettingsPanelProps> = React.memo(({
  isOpen,
  onClose,
  fontSize,
  fontFamily,
  lineHeight,
  theme,
  maxWidth,
  margin,
  onFontSizeChange,
  onFontFamilyChange,
  onLineHeightChange,
  onThemeChange,
  onMaxWidthChange,
  onMarginChange,
  onReset,
}) => {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const dragControls = useDragControls();
  const [dragY, setDragY] = useState(0);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open on mobile
  useEffect(() => {
    if (isMobile && isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isMobile, isOpen]);

  // Handle drag end for bottom sheet
  const handleDragEnd = useCallback((_: unknown, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
    setDragY(0);
  }, [onClose]);

  // Get active width preset
  const activeWidthPreset = widthPresets.find(p => Math.abs(p.value - maxWidth) < 50)?.value || maxWidth;

  // Panel content
  const panelContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        {isMobile && (
          <div className="absolute left-1/2 -translate-x-1/2 top-2">
            <GripHorizontal className="w-8 h-1 text-muted-foreground/50" />
          </div>
        )}
        <h2 id="reader-settings-title" className="text-lg font-semibold text-foreground">
          {t('reader.settings') || 'Reading Settings'}
        </h2>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-11 h-11 -mr-2
                     rounded-lg hover:bg-muted transition-colors touch-target"
          aria-label="Close settings"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-6 space-y-8">
        {/* Theme Section */}
        <section>
          <SectionHeader icon={<Sun className="w-5 h-5" />} title={t('readerSettings.theme') || 'Theme'} />
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(themeConfigs) as ReaderTheme[]).map((themeKey) => (
              <ThemeButton
                key={themeKey}
                theme={themeKey}
                isActive={theme === themeKey}
                onClick={() => onThemeChange(themeKey)}
              />
            ))}
          </div>
        </section>

        {/* Typography Section */}
        <section>
          <SectionHeader icon={<Type className="w-5 h-5" />} title={t('readerSettings.typography') || 'Typography'} />
          <div className="space-y-6">
            {/* Font Size */}
            <StepperControl
              label={t('readerSettings.fontSize') || 'Font Size'}
              value={fontSize}
              min={12}
              max={32}
              step={2}
              unit="px"
              onChange={onFontSizeChange}
            />

            {/* Font Family */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground block">
                {t('readerSettings.fontFamily') || 'Font Family'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {fontFamilyOptions.map((family) => (
                  <FontFamilyButton
                    key={family.value}
                    family={family}
                    isActive={fontFamily === family.value}
                    onClick={() => onFontFamilyChange(family.value)}
                  />
                ))}
              </div>
            </div>

            {/* Line Height */}
            <SliderControl
              label={t('readerSettings.lineHeight') || 'Line Height'}
              value={lineHeight}
              min={1.2}
              max={2.5}
              step={0.1}
              onChange={onLineHeightChange}
              formatValue={(v) => v.toFixed(1)}
            />
          </div>
        </section>

        {/* Layout Section */}
        <section>
          <SectionHeader icon={<Maximize2 className="w-5 h-5" />} title={t('readerSettings.layout') || 'Layout'} />
          <div className="space-y-6">
            {/* Text Width */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground block">
                {t('readerSettings.textWidth') || 'Text Width'}
              </label>
              <div className="flex gap-2">
                {widthPresets.map((preset) => (
                  <WidthPresetButton
                    key={preset.value}
                    preset={preset}
                    isActive={activeWidthPreset === preset.value}
                    onClick={() => onMaxWidthChange(preset.value)}
                  />
                ))}
              </div>
            </div>

            {/* Margins */}
            <SliderControl
              label={t('readerSettings.margins') || 'Margins'}
              value={margin}
              min={20}
              max={80}
              step={10}
              unit="px"
              onChange={onMarginChange}
            />
          </div>
        </section>
      </div>

      {/* Footer with reset button */}
      {onReset && (
        <div className="px-6 py-4 border-t border-border pb-safe">
          <button
            onClick={onReset}
            aria-label={t('readerSettings.resetToDefaults') || 'Reset to Defaults'}
            className="w-full flex items-center justify-center gap-2 py-3 px-4
                       rounded-xl border-2 border-border bg-card
                       hover:bg-muted hover:border-muted-foreground/30
                       transition-colors touch-target text-muted-foreground
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span className="text-sm font-medium">
              {t('readerSettings.resetToDefaults') || 'Reset to Defaults'}
            </span>
          </button>
        </div>
      )}
    </div>
  );

  // Mobile bottom sheet
  const mobileSheet = (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-settings-title"
      initial={{ y: '100%' }}
      animate={{ y: dragY }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      drag="y"
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.5 }}
      onDrag={(_, info) => setDragY(Math.max(0, info.offset.y))}
      onDragEnd={handleDragEnd}
      className="fixed inset-x-0 bottom-0 z-[500] bg-background rounded-t-xl shadow-2xl
                 max-h-[90vh] flex flex-col touch-none"
    >
      {/* Drag handle */}
      <div
        className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => dragControls.start(e)}
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
      </div>
      {panelContent}
    </m.div>
  );

  // Desktop side panel
  const desktopPanel = (
    <m.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reader-settings-title"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 bottom-0 z-[500] w-[380px] bg-background shadow-2xl
                 border-l border-border flex flex-col"
    >
      {panelContent}
    </m.div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[400] bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          {isMobile ? mobileSheet : desktopPanel}
        </>
      )}
    </AnimatePresence>
  );
});

ReaderSettingsPanel.displayName = 'ReaderSettingsPanel';

export default ReaderSettingsPanel;
