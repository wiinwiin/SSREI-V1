interface BaseProps {
  label: string;
  required?: boolean;
  className?: string;
}

interface InputProps extends BaseProps {
  type: 'text' | 'number' | 'date' | 'email';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

interface SelectProps extends BaseProps {
  type: 'select';
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}

interface TextareaProps extends BaseProps {
  type: 'textarea';
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

interface ToggleProps extends BaseProps {
  type: 'toggle';
  value: boolean;
  onChange: (v: boolean) => void;
}

type FieldProps = InputProps | SelectProps | TextareaProps | ToggleProps;

const labelClass = 'block font-body text-sm font-medium text-gray-700 mb-1.5';
const inputClass =
  'w-full font-body text-sm border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors bg-white';

export function FormField(props: FieldProps) {
  const { label, required, className = '' } = props;

  return (
    <div className={className}>
      <label className={labelClass}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {props.type === 'select' && (
        <select
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          className={inputClass}
        >
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      {props.type === 'textarea' && (
        <textarea
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={props.placeholder}
          rows={props.rows ?? 3}
          className={`${inputClass} resize-none`}
        />
      )}

      {props.type === 'toggle' && (
        <div className="flex items-center gap-3 mt-1">
          <button
            type="button"
            onClick={() => props.onChange(!props.value)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
              props.value ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                props.value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className="font-body text-sm text-gray-600">{props.value ? 'Yes' : 'No'}</span>
        </div>
      )}

      {(props.type === 'text' || props.type === 'number' || props.type === 'date' || props.type === 'email') && (
        <input
          type={props.type}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder={'placeholder' in props ? props.placeholder : undefined}
          readOnly={'readOnly' in props ? props.readOnly : false}
          className={`${inputClass} ${'readOnly' in props && props.readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
        />
      )}
    </div>
  );
}
