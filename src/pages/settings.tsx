/**
 * 设置页面
 * 包含LLM配置和其他系统设置
 */
import React, { useState } from 'react';
import {
  Box,
  Container,
  Tabs,
  Tab,
  Paper,
  Typography,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Psychology as PsychologyIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import LLMConfigPanel from '../components/settings/LLMConfigPanel';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SettingsPage() {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h3" gutterBottom>
        系统设置
      </Typography>

      <Paper sx={{ mt: 3 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          aria-label="settings tabs"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab
            icon={<PsychologyIcon />}
            label="LLM配置"
            id="settings-tab-0"
            aria-controls="settings-tabpanel-0"
          />
          <Tab
            icon={<SettingsIcon />}
            label="常规设置"
            id="settings-tab-1"
            aria-controls="settings-tabpanel-1"
          />
          <Tab
            icon={<SecurityIcon />}
            label="安全设置"
            id="settings-tab-2"
            aria-controls="settings-tabpanel-2"
          />
          <Tab
            icon={<NotificationsIcon />}
            label="通知设置"
            id="settings-tab-3"
            aria-controls="settings-tabpanel-3"
          />
        </Tabs>

        <TabPanel value={currentTab} index={0}>
          <LLMConfigPanel />
        </TabPanel>

        <TabPanel value={currentTab} index={1}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              常规设置
            </Typography>
            <Typography color="text.secondary">
              常规系统设置功能即将推出...
            </Typography>
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={2}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              安全设置
            </Typography>
            <Typography color="text.secondary">
              安全设置功能即将推出...
            </Typography>
          </Box>
        </TabPanel>

        <TabPanel value={currentTab} index={3}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              通知设置
            </Typography>
            <Typography color="text.secondary">
              通知设置功能即将推出...
            </Typography>
          </Box>
        </TabPanel>
      </Paper>
    </Container>
  );
}
