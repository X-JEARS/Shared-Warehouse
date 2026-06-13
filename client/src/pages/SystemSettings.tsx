import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useTranslation } from 'react-i18next';
import { useThemeStore, ThemeMode, StyleVariant, LanguageMode } from '../stores/themeStore';

const Container = styled.div`
  min-height: 100%;
  background: var(--app-color-bg);
`;

const Header = styled.div`
  background: var(--app-color-surface);
  padding: 8px 16px;
  border-bottom: 1px solid var(--app-color-border);
  display: flex;
  align-items: center;
  position: sticky;
  top: 0;
  z-index: 100;
`;

const BackButton = styled.div`
  font-size: 20px;
  margin-right: 12px;
  cursor: pointer;
  color: var(--app-color-text);
`;

const HeaderTitle = styled.div`
  font-size: 16px;
  font-weight: 500;
  color: var(--app-color-text);
`;

const ThemeSection = styled.div`
  background: var(--app-color-surface);
  margin-top: 12px;
  padding: 16px;
`;

const ThemeSectionTitle = styled.div`
  font-size: 13px;
  color: var(--app-color-text-secondary);
  margin-bottom: 12px;
`;

const ThemeOptions = styled.div`
  display: flex;
  gap: 12px;
`;

const ThemeOption = styled.div<{ $active: boolean }>`
  flex: 1;
  padding: 16px 12px;
  border-radius: var(--app-radius-card);
  border: 2px solid ${(props) => (props.$active ? 'var(--app-color-primary)' : 'var(--app-color-border)')};
  background: var(--app-color-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: border-color 0.2s;

  &:active {
    opacity: 0.8;
  }
`;

const ThemeIcon = styled.div<{ $variant: 'light' | 'dark' | 'system' }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;

  ${(props) => {
    switch (props.$variant) {
      case 'light':
        return 'background: #f5f5f5; color: #333;';
      case 'dark':
        return 'background: #1a1a1a; color: #e6e6e6;';
      case 'system':
        return 'background: linear-gradient(135deg, #f5f5f5 50%, #1a1a1a 50%); color: #666;';
    }
  }}
`;

const LanguageIcon = styled.div<{ $variant: 'system' | 'zh' | 'en' }>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;

  ${(props) => {
    switch (props.$variant) {
      case 'system':
        return 'background: linear-gradient(135deg, #e8f4f8 50%, #f0e6ff 50%); color: #666;';
      case 'zh':
        return 'background: #fee2e2; color: #dc2626;';
      case 'en':
        return 'background: #dbeafe; color: #2563eb;';
    }
  }}
`;

const ThemeOptionLabel = styled.div<{ $active: boolean }>`
  font-size: 13px;
  color: ${(props) => (props.$active ? 'var(--app-color-primary)' : 'var(--app-color-text)')};
  font-weight: ${(props) => (props.$active ? 600 : 400)};
`;

const ThemeOptionHint = styled.div`
  font-size: 11px;
  color: var(--app-color-text-secondary);
`;

const StylePreviewBox = styled.div<{ $style: StyleVariant }>`
  width: 44px;
  height: 44px;
  border: 2px solid var(--app-color-border);
  background: var(--app-color-surface);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 5px;

  ${(props) => {
    switch (props.$style) {
      case 'default':
        return 'border-radius: 8px;';
      case 'rounded':
        return 'border-radius: 16px;';
      case 'compact':
        return 'border-radius: 3px; gap: 2px; padding: 3px;';
    }
  }}
`;

const PreviewLine = styled.div<{ $short?: boolean }>`
  height: 3px;
  border-radius: 2px;
  background: var(--app-color-primary);
  width: ${(props) => (props.$short ? '40%' : '100%')};
  opacity: ${(props) => (props.$short ? 0.4 : 0.7)};
`;

export default function SystemSettings() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme, effectiveTheme, style, language, effectiveLanguage, setTheme, setStyle, setLanguage } = useThemeStore();

  const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: string; variant: 'light' | 'dark' | 'system' }[] = [
    { mode: 'light', label: t('systemSettings.lightMode'), icon: '☀️', variant: 'light' },
    { mode: 'dark', label: t('systemSettings.darkMode'), icon: '🌙', variant: 'dark' },
    { mode: 'system', label: t('systemSettings.systemMode'), icon: '💻', variant: 'system' },
  ];

  const STYLE_OPTIONS: { style: StyleVariant; label: string; desc: string }[] = [
    { style: 'default', label: t('systemSettings.styleDefault'), desc: t('systemSettings.styleDefaultDesc') },
    { style: 'rounded', label: t('systemSettings.styleRounded'), desc: t('systemSettings.styleRoundedDesc') },
    { style: 'compact', label: t('systemSettings.styleCompact'), desc: t('systemSettings.styleCompactDesc') },
  ];

  const LANGUAGE_OPTIONS: { mode: LanguageMode; label: string; iconText: string; variant: 'system' | 'zh' | 'en' }[] = [
    { mode: 'system', label: t('systemSettings.languageSystem'), iconText: '🌐', variant: 'system' },
    { mode: 'zh-CN', label: t('systemSettings.languageZhCN'), iconText: '中', variant: 'zh' },
    { mode: 'en-US', label: t('systemSettings.languageEnUS'), iconText: 'En', variant: 'en' },
  ];

  const currentLanguageName = effectiveLanguage === 'zh-CN' ? t('systemSettings.languageZhCN') : t('systemSettings.languageEnUS');
  const currentThemeName = effectiveTheme === 'dark' ? t('systemSettings.darkTheme') : t('systemSettings.lightTheme');

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>{t('systemSettings.title')}</HeaderTitle>
      </Header>

      <ThemeSection>
        <ThemeSectionTitle>{t('systemSettings.language')}</ThemeSectionTitle>
        <ThemeOptions>
          {LANGUAGE_OPTIONS.map((option) => (
            <ThemeOption
              key={option.mode}
              $active={language === option.mode}
              onClick={() => setLanguage(option.mode)}
            >
              <LanguageIcon $variant={option.variant}>
                {option.iconText}
              </LanguageIcon>
              <ThemeOptionLabel $active={language === option.mode}>
                {option.label}
              </ThemeOptionLabel>
              {option.mode === 'system' && (
                <ThemeOptionHint>
                  {t('systemSettings.currentLanguage', { language: currentLanguageName })}
                </ThemeOptionHint>
              )}
            </ThemeOption>
          ))}
        </ThemeOptions>
      </ThemeSection>

      <ThemeSection>
        <ThemeSectionTitle>{t('systemSettings.themeMode')}</ThemeSectionTitle>
        <ThemeOptions>
          {THEME_OPTIONS.map((option) => (
            <ThemeOption
              key={option.mode}
              $active={theme === option.mode}
              onClick={() => setTheme(option.mode)}
            >
              <ThemeIcon $variant={option.variant}>
                {option.icon}
              </ThemeIcon>
              <ThemeOptionLabel $active={theme === option.mode}>
                {option.label}
              </ThemeOptionLabel>
              {option.mode === 'system' && (
                <ThemeOptionHint>
                  {t('systemSettings.currentTheme', { theme: currentThemeName })}
                </ThemeOptionHint>
              )}
            </ThemeOption>
          ))}
        </ThemeOptions>
      </ThemeSection>

      <ThemeSection>
        <ThemeSectionTitle>{t('systemSettings.visualStyle')}</ThemeSectionTitle>
        <ThemeOptions>
          {STYLE_OPTIONS.map((option) => (
            <ThemeOption
              key={option.style}
              $active={style === option.style}
              onClick={() => setStyle(option.style)}
            >
              <StylePreviewBox $style={option.style}>
                <PreviewLine />
                <PreviewLine $short />
                <PreviewLine />
              </StylePreviewBox>
              <ThemeOptionLabel $active={style === option.style}>
                {option.label}
              </ThemeOptionLabel>
              <ThemeOptionHint>{option.desc}</ThemeOptionHint>
            </ThemeOption>
          ))}
        </ThemeOptions>
      </ThemeSection>
    </Container>
  );
}
