import {
  Button,
  ChakraProvider,
  extendTheme,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  useDisclosure,
} from "@chakra-ui/react";
import AppRouteProvider from "./routes/AppRouteProvider";
import React, { useEffect } from "react";
import "./App.css";
import "@fontsource/sora";

const config = {
  initialColorMode: "dark" as const,
  useSystemColorMode: false,
};

const theme = extendTheme({
  config,
  fonts: {
    heading: `Sora, Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif`,
    body: `Sora, Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif`,
  },
  colors: {
    light: {
      bg: "#ffffff",
      text: "#000000",
      border: "#e0e0e0",
      hover: "#f5f5f5",
    },
    dark: {
      bg: "#1a1a1a",
      text: "#ffffff",
      border: "#333333",
      hover: "#2a2a2a",
    },
  },
  semanticTokens: {
    colors: {
      "bg-primary": {
        light: "#ffffff",
        dark: "#1a1a1a",
      },
      "bg-secondary": {
        light: "#f5f5f5",
        dark: "#2a2a2a",
      },
      "text-primary": {
        light: "#000000",
        dark: "#ffffff",
      },
      "border-color": {
        light: "#e0e0e0",
        dark: "#333333",
      },
    },
  },
  styles: {
    global: {
      body: {
        _light: {
          bg: "#ffffff",
          color: "#000000",
        },
        _dark: {
          bg: "#1a1a1a",
          color: "#ffffff",
        },
      },
      "html, body": {
        _light: {
          bg: "#ffffff",
        },
        _dark: {
          bg: "#1a1a1a",
        },
      },
    },
  },
});

function App() {
  return (
    <>
      <ChakraProvider theme={theme}>
        <AppRouteProvider></AppRouteProvider>

        {/* <BasicUsage /> */}
      </ChakraProvider>
    </>
  );
}

export default App;

function BasicUsage() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    onOpen.call(onOpen);
  }, []);

  return (
    <>
      <Button onClick={onOpen}>Open Modal</Button>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Modal Title</ModalHeader>
          <ModalCloseButton />
          <ModalBody>Body</ModalBody>

          <ModalFooter>
            <Button colorScheme="blue" mr={3} onClick={onClose}>
              Close
            </Button>
            <Button variant="ghost">Secondary Action</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
