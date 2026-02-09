"""
Gemini API wrapper for CLARITY.
Handles all AI calls: proposition parsing, insight generation, fact-checking.
"""

import os
import json
from dotenv import load_dotenv

load_dotenv()

# Import the Gemini SDK (google-genai)
try:
    from google import genai
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    SDK_AVAILABLE = True
except ImportError:
    SDK_AVAILABLE = False
    print("WARNING: google-genai SDK not available. Install: pip install google-genai")


# Use gemini-2.0-flash first (fast, cheap, high rate limit) — avoid exp models to prevent 429
DEFAULT_MODEL_OPTIONS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]

FAST_MODEL_OPTIONS = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
]


def call_gemini(
    prompt: str,
    system_instruction: str = "",
    temperature: float = 0.2,
    response_mime_type: str = "application/json",
    use_grounding: bool = False,
    model: str | None = None,
) -> str:
    """
    Make a Gemini API call and return the response text.
    
    Args:
        prompt: The user message
        system_instruction: System prompt
        temperature: 0.0-1.0 (low = more deterministic)
        response_mime_type: "application/json" for structured output, "text/plain" for free text
        use_grounding: Whether to enable Google Search grounding
    
    Returns:
        Response text string
    """
    
    if not SDK_AVAILABLE:
        raise RuntimeError("Gemini SDK not available")
    
    config = {
        "temperature": temperature,
        "response_mime_type": response_mime_type,
        "max_output_tokens": 8192,
    }
    
    if system_instruction:
        config["system_instruction"] = system_instruction
    
    if use_grounding:
        # Add Google Search grounding tool
        config["tools"] = [{"google_search": {}}]
        # Can't combine grounding with JSON output
        config["response_mime_type"] = "text/plain"
    
    model_options = [model] + [m for m in DEFAULT_MODEL_OPTIONS if m != model] if model else DEFAULT_MODEL_OPTIONS
    last_error = None
    for model_name in model_options:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=prompt,
                config=config,
            )
            return response.text
        except Exception as e:
            last_error = e
            # Try next model if this one doesn't exist
            if "not found" in str(e).lower() or "404" in str(e):
                continue
            # Other errors should be raised immediately
            raise
    
    raise RuntimeError(f"No working Gemini model found. Tried: {model_options}. Last error: {last_error}")


def _safe_parse_json(text: str) -> dict | None:
    """Parse JSON with repair for truncated responses."""
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    try:
        import json_repair
        repaired = json_repair.repair_json(cleaned)
        result = json.loads(repaired)
        print("⚠️ JSON was truncated, repaired successfully")
        return result
    except ImportError:
        pass
    except Exception:
        pass

    try:
        open_braces = cleaned.count("{") - cleaned.count("}")
        open_brackets = cleaned.count("[") - cleaned.count("]")
        last_comma = cleaned.rfind(",")
        if last_comma > 0:
            cleaned = cleaned[:last_comma]
        cleaned += "]" * open_brackets + "}" * open_braces
        result = json.loads(cleaned)
        print(f"⚠️ JSON manually repaired (closed {open_braces} braces, {open_brackets} brackets)")
        return result
    except Exception as e:
        print(f"❌ JSON repair failed: {e}")
        return None


def call_gemini_json(
    prompt: str,
    system_instruction: str = "",
    temperature: float = 0.2,
    model: str | None = None,
) -> dict:
    """Call Gemini and parse the response as JSON."""
    response_text = call_gemini(
        prompt=prompt,
        system_instruction=system_instruction,
        temperature=temperature,
        response_mime_type="application/json",
        model=model,
    )

    result = _safe_parse_json(response_text)
    if result is None:
        print("Returning minimal fallback structure")
        return {
            "propositions": [],
            "relationships": [],
            "contradictions": [],
            "ambiguities": [],
            "tensions": [],
        }
    return result
