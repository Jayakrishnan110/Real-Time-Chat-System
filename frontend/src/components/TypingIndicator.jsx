export default function TypingIndicator({ name }) {
  return (
    <div className="flex justify-start px-2">
      <div className="bg-white rounded-lg px-3 py-2 shadow-sm flex items-center gap-2">
        <span className="text-xs text-gray-500">{name} is typing</span>
        <span className="flex gap-1">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </span>
      </div>
    </div>
  );
}

function Dot({ delay }) {
  return (
    <span
      className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}
