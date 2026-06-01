import { useNavigate } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import styled from 'styled-components';
import { useThemeStore, ThemeMode, StyleVariant } from '../stores/themeStore';

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

const Section = styled.div`
  background: var(--app-color-surface);
  margin-top: 12px;
`;

const SettingRow = styled.div`
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--app-color-border);
  cursor: pointer;

  &:last-child {
    border-bottom: none;
  }

  &:active {
    background: var(--app-color-hover);
  }
`;

const RowLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

const RowIcon = styled.span`
  font-size: 20px;
  color: var(--app-color-text);
  display: flex;
  align-items: center;
`;

const RowLabel = styled.div`
  font-size: 15px;
  color: var(--app-color-text);
`;

const RowRight = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const RowValue = styled.div`
  font-size: 14px;
  color: var(--app-color-text-secondary);
`;

const RowArrow = styled.div`
  color: var(--app-color-text-secondary);
  font-size: 14px;
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

const THEME_OPTIONS: { mode: ThemeMode; label: string; icon: string; variant: 'light' | 'dark' | 'system' }[] = [
  { mode: 'light', label: '浅色模式', icon: '☀️', variant: 'light' },
  { mode: 'dark', label: '深色模式', icon: '🌙', variant: 'dark' },
  { mode: 'system', label: '跟随系统', icon: '💻', variant: 'system' },
];

const STYLE_OPTIONS: { style: StyleVariant; label: string; desc: string }[] = [
  { style: 'default', label: '标准', desc: '默认圆角，经典风格' },
  { style: 'rounded', label: '圆润', desc: '大圆角，柔和卡通风格' },
  { style: 'compact', label: '紧凑', desc: '小圆角，简约扁平风格' },
];

export default function SystemSettings() {
  const navigate = useNavigate();
  const { theme, effectiveTheme, style, setTheme, setStyle } = useThemeStore();

  const handleLanguageClick = () => {
    Toast.show('暂未开放，敬请期待');
  };

  return (
    <Container>
      <Header>
        <BackButton onClick={() => navigate(-1)}>←</BackButton>
        <HeaderTitle>系统设置</HeaderTitle>
      </Header>

      <Section>
        <SettingRow onClick={handleLanguageClick}>
          <RowLeft>
            <RowIcon>🌐</RowIcon>
            <RowLabel>系统语言</RowLabel>
          </RowLeft>
          <RowRight>
            <RowValue>简体中文</RowValue>
            <RowArrow>›</RowArrow>
          </RowRight>
        </SettingRow>
      </Section>

      <ThemeSection>
        <ThemeSectionTitle>配色模式</ThemeSectionTitle>
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
                  当前：{effectiveTheme === 'dark' ? '深色' : '浅色'}
                </ThemeOptionHint>
              )}
            </ThemeOption>
          ))}
        </ThemeOptions>
      </ThemeSection>

      <ThemeSection>
        <ThemeSectionTitle>视觉风格</ThemeSectionTitle>
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