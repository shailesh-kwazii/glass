Make a plan for below App Behavior Requirements:

**Default State & Audio Capture:**

-   Start the application in continuous listening mode by default
-   Capture system audio output (device audio stream) - NOT microphone input
-   Continuously transcribe captured audio and append to conversation history buffer
-   Maintain conversation history with timestamps for context

**Keyboard Controls:**

-   **Command + /**:

    -   Pause audio capture
    -   Send accumulated conversation history to LLM
    -   Display LLM response with real-time streaming
    -   Resume listening mode after response completion

-   **Command + .**:
    -   Pause audio capture
    -   Send conversation history + current screenshot to LLM
    -   Display LLM response with real-time streaming
    -   Resume listening mode after response completion

**Screenshot Integration:**

-   Continuously capture screenshots at regular intervals during listening mode
-   Store only the latest screenshot to optimize memory usage
-   Include screenshot in multimodal LLM requests when Command + . is pressed

**Technical Considerations:**

-   Implement proper audio device permissions and system audio access
-   Handle transcription errors gracefully
-   Ensure conversation history doesn't exceed memory limits (implement rolling buffer if needed)
-   Provide visual indicators for current app state (listening/processing/responding)
-   Handle edge cases like no audio detected or transcription failures
