import { initials } from '../utils/format.js';

export default function Avatar({ name, photoURL, size = 40, online }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {photoURL ? (
        <img
          src={photoURL}
          alt={name}
          className="rounded-full object-cover w-full h-full"
        />
      ) : (
        <div
          className="rounded-full bg-wa-teal text-white flex items-center justify-center font-semibold w-full h-full"
          style={{ fontSize: size * 0.4 }}
        >
          {initials(name || '?')}
        </div>
      )}
      {online && (
        <span className="absolute bottom-0 right-0 w-3 h-3 bg-wa-green border-2 border-white rounded-full" />
      )}
    </div>
  );
}
