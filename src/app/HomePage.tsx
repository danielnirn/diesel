import { Link } from 'react-router-dom'
import { features } from './features'

export function HomePage() {
  return (
    <ul className="feature-list">
      {features.map((feature) => (
        <li key={feature.path}>
          <Link to={`/${feature.path}`} className="card feature-card">
            <span className="feature-icon">{feature.icon}</span>
            <span>
              <strong>{feature.title}</strong>
              <small>{feature.description}</small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
