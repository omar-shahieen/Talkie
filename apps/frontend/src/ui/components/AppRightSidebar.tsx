import { Box } from "@chakra-ui/react";
import React from "react";
import { useThemedColors } from "../theme/colors";
import AppMemberList from "./AppMemberList";

export default function AppRightSidebar() {
  const colors = useThemedColors();
  return (
    <Box
      width="325px"
      paddingX="5px"
      backgroundColor={colors.grayMedium}
      display="flex"
      flexDirection="column"
      // flexGrow={1}
    >
      <AppMemberList />
    </Box>
  );
}
