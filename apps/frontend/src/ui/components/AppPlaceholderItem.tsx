import { Avatar, Box } from "@chakra-ui/react";
import React from "react";
import { useThemedColors } from "../theme/colors";

export default function AppPlaceholderItem() {
  const colors = useThemedColors();
  return (
    <Box display="flex" marginY="15px">
      <Avatar backgroundColor={colors.grayMedium}></Avatar>

      <Box width="15px"></Box>

      <Box
        height="225px"
        width="500px"
        borderRadius="5px"
        backgroundColor={colors.grayMedium}
      ></Box>
    </Box>
  );
}
