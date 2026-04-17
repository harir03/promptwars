"""Gemini-powered AI concierge agent with function calling.

Uses Google GenAI SDK to provide a conversational venue assistant.
Includes fallback responses if Gemini is unavailable (P21).
Conversation history capped at 20 messages (P9).
Temperature set to 0.3 for focused responses (P10).
"""

from __future__ import annotations

import logging
from typing import Any

from app.agent.tools import (
    TOOL_SCHEMAS,
    find_shortest_queue,
    get_crowd_status,
    get_reward_offers,
    locate_friend,
    predict_exit,
)
from app.crowd.models import GamePhase

logger = logging.getLogger(__name__)

MAX_HISTORY_LENGTH = 20  # P9: Cap conversation history

SYSTEM_PROMPT = """You are VenuePulse Concierge, an AI assistant for attendees at DY Patil Stadium, Navi Mumbai.

YOUR PERSONALITY:
- Friendly but concise — like a knowledgeable friend who works at the stadium
- Use natural language, not robotic responses
- Include specific numbers (wait times, percentages, distances)
- Be proactive — if you see an opportunity to save the user time, mention it

YOUR CONTEXT:
- You know the user's seat section (provided in each message)
- You have access to LIVE crowd data via your tools
- You can check wait times, predict surges, find offers, and locate friends
- The stadium has 8 seating sections (A-H), 4 food courts (F1-F4), 4 restrooms (R1-R4), and 6 gates (G1-G6)

RULES:
1. ALWAYS call a tool before answering crowd/queue/exit questions — never guess
2. Keep responses under 150 words
3. If asked something unrelated to the venue, politely redirect: "I'm here to help with your stadium experience! Try asking about food, exits, or crowd levels."
4. When recommending a location, include walking directions from the user's seat section
5. Mention active reward offers when relevant (users earn points for smart choices)
6. Use emoji sparingly but effectively (🍔 for food, 🚪 for exits, 👥 for friends, 🎁 for rewards)

WALKING TIMES FROM EACH SECTION (approximate):
- Adjacent section: 2 min
- Opposite section: 5 min
- Nearest food court: 1-2 min
- Nearest gate: 2-3 min"""


class VenueConcierge:
    """AI concierge agent powered by Gemini with function calling."""

    def __init__(
        self,
        api_key: str,
        simulator: Any,
        predictor: Any,
        rewards_engine: Any,
    ) -> None:
        self.simulator = simulator
        self.predictor = predictor
        self.rewards_engine = rewards_engine
        self.api_key = api_key

        # Per-session conversation histories (P9)
        self._histories: dict[str, list[dict]] = {}

        # Initialize Gemini client
        self._client = None
        self._init_client()

    def _init_client(self) -> None:
        """Initialize the Google GenAI client."""
        if not self.api_key:
            logger.warning("No Gemini API key configured — agent will use fallback responses")
            return

        try:
            from google import genai

            self._client = genai.Client(api_key=self.api_key)
            logger.info("Gemini client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            self._client = None

    async def chat(self, message: str, session_id: str, seat_section: str = "C") -> dict:
        """Process a chat message and return a response.

        Args:
            message: The user's message.
            session_id: Unique session identifier for conversation history.
            seat_section: The user's seat section (e.g., "C").

        Returns:
            Dict with 'response', 'suggestions', and 'is_fallback' fields.
        """
        # Build context prefix
        game = self.simulator.clock.get_state()
        context = (
            f"[User is in Section {seat_section}. "
            f"Game: {game.phase.value}, Minute {game.minute}, "
            f"Score: Home {game.home_score} - Away {game.away_score}]"
        )

        # Try Gemini first, fall back if unavailable (P21)
        if self._client:
            try:
                return await self._gemini_chat(message, session_id, context)
            except Exception as e:
                logger.error(f"Gemini API error: {e}")
                return self._fallback_response(message, seat_section)
        else:
            return self._fallback_response(message, seat_section)

    async def _gemini_chat(self, message: str, session_id: str, context: str) -> dict:
        """Send message to Gemini with function calling."""
        from google.genai import types

        # Get or create conversation history
        history = self._histories.setdefault(session_id, [])

        # Add user message
        history.append({"role": "user", "parts": [{"text": f"{context}\n{message}"}]})

        # Trim history (P9)
        if len(history) > MAX_HISTORY_LENGTH:
            history = history[-MAX_HISTORY_LENGTH:]
            self._histories[session_id] = history

        # Configure tools
        tools = [types.Tool(function_declarations=[
            types.FunctionDeclaration(
                name=t["name"],
                description=t["description"],
                parameters=t.get("parameters"),
            )
            for t in TOOL_SCHEMAS
        ])]

        # Call Gemini
        response = self._client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[
                types.Content(role="user", parts=[types.Part.from_text(SYSTEM_PROMPT)]),
                *[
                    types.Content(
                        role=msg["role"],
                        parts=[types.Part.from_text(p["text"]) for p in msg["parts"]],
                    )
                    for msg in history
                ],
            ],
            config=types.GenerateContentConfig(
                tools=tools,
                temperature=0.3,  # P10: Focused responses
                max_output_tokens=500,
            ),
        )

        # Handle function calls
        result_text = ""
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if part.function_call:
                    tool_result = self._execute_tool(
                        part.function_call.name,
                        dict(part.function_call.args) if part.function_call.args else {},
                    )

                    # Send tool result back to Gemini for final response
                    follow_up = self._client.models.generate_content(
                        model="gemini-2.0-flash",
                        contents=[
                            types.Content(role="user", parts=[types.Part.from_text(SYSTEM_PROMPT)]),
                            *[
                                types.Content(
                                    role=msg["role"],
                                    parts=[types.Part.from_text(p["text"]) for p in msg["parts"]],
                                )
                                for msg in history
                            ],
                            types.Content(
                                role="model",
                                parts=[types.Part.from_text(
                                    f"[Tool '{part.function_call.name}' returned:\n{tool_result}]"
                                )],
                            ),
                            types.Content(
                                role="user",
                                parts=[types.Part.from_text(
                                    "Based on the tool result above, provide a helpful, "
                                    "conversational response to the user. Be specific with numbers."
                                )],
                            ),
                        ],
                        config=types.GenerateContentConfig(temperature=0.3, max_output_tokens=500),
                    )

                    if follow_up.text:
                        result_text = follow_up.text
                elif part.text:
                    result_text += part.text

        if not result_text:
            result_text = "I'm having trouble processing that. Could you rephrase?"

        # Add assistant response to history
        history.append({"role": "model", "parts": [{"text": result_text}]})

        # Generate suggestions based on game phase
        suggestions = self._get_suggestions()

        return {
            "response": result_text,
            "suggestions": suggestions,
            "is_fallback": False,
        }

    def _execute_tool(self, tool_name: str, args: dict) -> str:
        """Execute a tool function and return its result.

        Args:
            tool_name: Name of the tool to execute.
            args: Arguments from Gemini's function call.

        Returns:
            String result from the tool.
        """
        try:
            if tool_name == "get_crowd_status":
                return get_crowd_status(self.simulator, args.get("zone_id"))
            elif tool_name == "find_shortest_queue":
                return find_shortest_queue(self.simulator, args.get("queue_type", "food"))
            elif tool_name == "predict_exit":
                return predict_exit(self.simulator, self.predictor, args.get("gate_id"))
            elif tool_name == "get_reward_offers":
                return get_reward_offers(self.rewards_engine)
            elif tool_name == "locate_friend":
                return locate_friend(args.get("friend_id", "friend_1"))
            else:
                return f"Unknown tool: {tool_name}"
        except Exception as e:
            logger.error(f"Tool execution error ({tool_name}): {e}")
            return f"Error executing {tool_name}: {str(e)}"

    def _fallback_response(self, message: str, seat_section: str) -> dict:
        """Generate a fallback response when Gemini is unavailable (P21).

        Uses current simulator data to construct a helpful response.
        """
        msg_lower = message.lower()

        # Detect intent and respond with live data
        if any(word in msg_lower for word in ["food", "eat", "hungry", "snack"]):
            result = find_shortest_queue(self.simulator, "food")
            response = f"🍔 Here's what I found:\n{result}\n\nI'd recommend the one with the shortest wait!"

        elif any(word in msg_lower for word in ["restroom", "bathroom", "toilet", "wc"]):
            result = find_shortest_queue(self.simulator, "restroom")
            response = f"🚻 Here's the restroom status:\n{result}"

        elif any(word in msg_lower for word in ["exit", "leave", "gate", "go home"]):
            result = predict_exit(self.simulator, self.predictor)
            response = f"🚪 Exit info:\n{result}"

        elif any(word in msg_lower for word in ["crowd", "busy", "packed", "density"]):
            result = get_crowd_status(self.simulator)
            response = f"📊 Current crowd status:\n{result}"

        elif any(word in msg_lower for word in ["reward", "point", "offer", "discount"]):
            result = get_reward_offers(self.rewards_engine)
            response = f"🎁 {result}"

        elif any(word in msg_lower for word in ["friend", "group", "find", "where"]):
            result = locate_friend()
            response = f"👥 {result}"

        else:
            response = (
                "👋 Hi! I'm your VenuePulse concierge. I can help you with:\n"
                "🍔 **Food** — Find the shortest queue\n"
                "🚻 **Restrooms** — Check wait times\n"
                "🚪 **Exits** — Best time and gate to leave\n"
                "📊 **Crowds** — See density across the stadium\n"
                "🎁 **Rewards** — Active offers and discounts\n"
                "👥 **Friends** — Locate your group\n\n"
                "What would you like to know?"
            )

        return {
            "response": response,
            "suggestions": self._get_suggestions(),
            "is_fallback": True,
        }

    def _get_suggestions(self) -> list[str]:
        """Generate contextual quick-action suggestions based on game phase."""
        phase = self.simulator.clock.phase

        if phase == GamePhase.PRE_MATCH:
            return ["Where should I eat?", "How crowded is my section?", "Find my friends"]
        elif phase in (GamePhase.FIRST_HALF, GamePhase.SECOND_HALF):
            return ["Shortest food queue?", "When should I leave?", "Any rewards?"]
        elif phase == GamePhase.HALFTIME:
            return ["Best food court right now?", "Restroom wait times?", "Show me offers"]
        elif phase == GamePhase.POST_MATCH:
            return ["Best exit gate?", "When should I leave?", "Parking status?"]
        return ["How crowded is it?", "Where's food?", "Show me exits"]
