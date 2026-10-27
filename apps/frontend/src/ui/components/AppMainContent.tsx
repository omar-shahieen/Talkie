import React from 'react';
import { Box } from '@chakra-ui/react';
import AppChatContainer from './AppChatContainer';
import AppMainTopbar from './AppMainTopbar';
import AppRightSidebar from './AppRightSidebar';
import { useThemedColors } from '../theme/colors';

export type AppMainContentProps = {
  children: React.ReactNode;
};

export default function AppMainContent({ children }: AppMainContentProps) {
  const colors = useThemedColors();
  return (
    <Box
      backgroundColor={colors.grayLight}
      width="100%"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
    >
      <AppMainTopbar />

      <Box flexGrow={1} display="flex" justifyContent="space-between">
        <Box
          width="100%"
          display="flex"
          justifyContent="space-between"
          flexDirection="column"
          backgroundColor={colors.grayLight}
        >
          {children}
        </Box>

        <AppRightSidebar />
      </Box>
    </Box>
  );
}
